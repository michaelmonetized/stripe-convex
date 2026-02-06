/**
 * @module stripe-convex/convex/webhooks
 * @description Stripe webhook event handlers with idempotency support
 */

import { v } from "convex/values";
import type { GenericMutationCtx, GenericDataModel } from "convex/server";

/**
 * Checks if a webhook event has already been processed.
 * Use this for idempotency to prevent duplicate processing.
 * 
 * @example
 * ```ts
 * const processed = await webhooks.hasProcessedEvent.handler(ctx, {
 *   stripeEventId: event.id,
 * });
 * if (processed) {
 *   return new Response("Already processed", { status: 200 });
 * }
 * ```
 */
export const hasProcessedEvent = {
  args: { stripeEventId: v.string() },
  /**
   * @param ctx - Convex mutation context
   * @param args - Stripe event ID
   * @returns True if event has been processed
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { stripeEventId: string }
  ): Promise<boolean> => {
    const db = ctx.db as any;
    const event = await db
      .query("sc_webhook_events")
      .withIndex("by_stripe_event", (q: any) =>
        q.eq("stripeEventId", args.stripeEventId)
      )
      .first();
    return !!event?.processedAt;
  },
};

/**
 * Records a webhook event for tracking and debugging.
 * Call this when you receive an event, before processing.
 * 
 * @example
 * ```ts
 * await webhooks.recordEvent.handler(ctx, {
 *   stripeEventId: event.id,
 *   type: event.type,
 *   data: event.data.object,
 * });
 * ```
 */
export const recordEvent = {
  args: {
    stripeEventId: v.string(),
    type: v.string(),
    data: v.any(),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Event details
   * @returns Event document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { stripeEventId: string; type: string; data: any }
  ) => {
    const db = ctx.db as any;
    
    // Check if already exists
    const existing = await db
      .query("sc_webhook_events")
      .withIndex("by_stripe_event", (q: any) =>
        q.eq("stripeEventId", args.stripeEventId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await db.insert("sc_webhook_events", {
      stripeEventId: args.stripeEventId,
      type: args.type,
      data: args.data,
      createdAt: Date.now(),
    });
  },
};

/**
 * Marks a webhook event as processed.
 * Call this after successfully handling an event.
 * 
 * @example
 * ```ts
 * // After processing...
 * await webhooks.markProcessed.handler(ctx, {
 *   stripeEventId: event.id,
 * });
 * 
 * // On error...
 * await webhooks.markProcessed.handler(ctx, {
 *   stripeEventId: event.id,
 *   error: "Processing failed: insufficient inventory",
 * });
 * ```
 */
export const markProcessed = {
  args: {
    stripeEventId: v.string(),
    error: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Event ID and optional error
   * @returns Event document ID
   * @throws Error if event not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { stripeEventId: string; error?: string }
  ) => {
    const db = ctx.db as any;
    const event = await db
      .query("sc_webhook_events")
      .withIndex("by_stripe_event", (q: any) =>
        q.eq("stripeEventId", args.stripeEventId)
      )
      .first();

    if (!event) {
      throw new Error(`Event not found: ${args.stripeEventId}`);
    }

    await db.patch(event._id, {
      processedAt: Date.now(),
      error: args.error,
    });

    return event._id;
  },
};

/**
 * Processes a checkout.session.completed webhook event.
 * Creates payment/subscription records and updates customer data.
 * 
 * @example
 * ```ts
 * // In your webhook handler
 * if (event.type === "checkout.session.completed") {
 *   const data = processWebhookEvent(event);
 *   await webhooks.processCheckoutCompleted.handler(ctx, data.data);
 * }
 * ```
 */
export const processCheckoutCompleted = {
  args: {
    sessionId: v.string(),
    customerEmail: v.string(),
    paymentIntentId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    amountTotal: v.number(),
    currency: v.string(),
    metadata: v.optional(v.any()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Checkout session data
   * @returns Object with type (payment/subscription) and created ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      sessionId: string;
      customerEmail: string;
      paymentIntentId?: string;
      subscriptionId?: string;
      amountTotal: number;
      currency: string;
      metadata?: any;
    }
  ) => {
    const db = ctx.db as any;
    const now = Date.now();

    // Create or get customer
    let customer = await db
      .query("sc_customers")
      .withIndex("by_email", (q: any) => q.eq("email", args.customerEmail))
      .first();

    if (!customer) {
      await db.insert("sc_customers", {
        email: args.customerEmail,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Handle one-time payment
    if (args.paymentIntentId && !args.subscriptionId) {
      const existingPayment = await db
        .query("sc_payments")
        .withIndex("by_stripe_payment_intent", (q: any) =>
          q.eq("stripePaymentIntentId", args.paymentIntentId)
        )
        .first();

      if (existingPayment) {
        await db.patch(existingPayment._id, {
          status: "succeeded",
          updatedAt: now,
        });
        return { type: "payment", id: existingPayment._id };
      }

      const paymentId = await db.insert("sc_payments", {
        email: args.customerEmail,
        amount: args.amountTotal,
        currency: args.currency,
        status: "succeeded",
        stripePaymentIntentId: args.paymentIntentId,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });

      return { type: "payment", id: paymentId };
    }

    // Handle subscription
    if (args.subscriptionId) {
      const planId = args.metadata?.planId || "default";
      const periodStart = args.metadata?.currentPeriodStart || now;
      const periodEnd = args.metadata?.currentPeriodEnd || now + 30 * 24 * 60 * 60 * 1000;

      const existingSubscription = await db
        .query("sc_subscriptions")
        .withIndex("by_stripe_subscription", (q: any) =>
          q.eq("stripeSubscriptionId", args.subscriptionId)
        )
        .first();

      if (existingSubscription) {
        await db.patch(existingSubscription._id, {
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        });
        return { type: "subscription", id: existingSubscription._id };
      }

      const subscriptionId = await db.insert("sc_subscriptions", {
        email: args.customerEmail,
        planId,
        status: "active",
        stripeSubscriptionId: args.subscriptionId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });

      return { type: "subscription", id: subscriptionId };
    }

    return null;
  },
};

/**
 * Processes a customer.subscription.updated webhook event.
 * Updates subscription status and billing period.
 */
export const processSubscriptionUpdate = {
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Subscription update data
   * @returns Subscription document ID or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      stripeSubscriptionId: string;
      status: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd?: boolean;
    }
  ) => {
    const db = ctx.db as any;
    const subscription = await db
      .query("sc_subscriptions")
      .withIndex("by_stripe_subscription", (q: any) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (!subscription) {
      console.log(`Subscription not found: ${args.stripeSubscriptionId}`);
      return null;
    }

    // Map Stripe status to our status
    const statusMap: Record<string, string> = {
      active: "active",
      past_due: "past_due",
      canceled: "cancelled",
      unpaid: "unpaid",
      trialing: "trialing",
      paused: "paused",
    };

    await db.patch(subscription._id, {
      status: statusMap[args.status] || args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
};

/**
 * Processes a customer.subscription.deleted webhook event.
 * Marks the subscription as cancelled.
 */
export const processSubscriptionDeleted = {
  args: { stripeSubscriptionId: v.string() },
  /**
   * @param ctx - Convex mutation context
   * @param args - Stripe subscription ID
   * @returns Subscription document ID or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { stripeSubscriptionId: string }
  ) => {
    const db = ctx.db as any;
    const subscription = await db
      .query("sc_subscriptions")
      .withIndex("by_stripe_subscription", (q: any) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (!subscription) {
      return null;
    }

    await db.patch(subscription._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
};

/**
 * Processes a charge.refunded webhook event.
 * Marks the associated payment as refunded.
 */
export const processRefund = {
  args: {
    chargeId: v.string(),
    paymentIntentId: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Charge ID and optional payment intent ID
   * @returns Payment document ID or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { chargeId: string; paymentIntentId?: string }
  ) => {
    const db = ctx.db as any;
    let payment = null;

    if (args.paymentIntentId) {
      payment = await db
        .query("sc_payments")
        .withIndex("by_stripe_payment_intent", (q: any) =>
          q.eq("stripePaymentIntentId", args.paymentIntentId)
        )
        .first();
    }

    if (!payment) {
      // Try to find by charge ID if stored
      const payments = await db.query("sc_payments").collect();
      payment = payments.find((p: any) => p.stripeChargeId === args.chargeId);
    }

    if (!payment) {
      console.log(`Payment not found for refund: ${args.chargeId}`);
      return null;
    }

    await db.patch(payment._id, {
      status: "refunded",
      updatedAt: Date.now(),
    });

    return payment._id;
  },
};
