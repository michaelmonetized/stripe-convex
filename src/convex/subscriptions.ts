/**
 * @module stripe-convex/convex/subscriptions
 * @description Subscription record management utilities
 */

import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import { subscriptionStatusValidator, metadataValidator } from "./schema.js";

/**
 * Creates a new subscription record.
 * Typically called when a new subscription is created via Stripe.
 * 
 * @example
 * ```ts
 * const subscriptionId = await subscriptions.create.handler(ctx, {
 *   email: "customer@example.com",
 *   planId: "pro",
 *   stripeSubscriptionId: "sub_1234567890",
 *   currentPeriodStart: Date.now(),
 *   currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
 * });
 * ```
 */
export const create = {
  args: {
    email: v.string(),
    planId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    metadata: metadataValidator,
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Subscription details
   * @returns Subscription document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      email: string;
      planId: string;
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      metadata?: any;
    }
  ) => {
    const db = ctx.db as any;
    const now = Date.now();

    return await db.insert("sc_subscriptions", {
      email: args.email,
      planId: args.planId,
      status: "active",
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
};

/**
 * Updates a subscription from Stripe webhook data.
 * Called from webhook handlers when subscription status changes.
 * 
 * @example
 * ```ts
 * await subscriptions.updateFromStripe.handler(ctx, {
 *   stripeSubscriptionId: "sub_1234567890",
 *   status: "past_due",
 *   currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
 * });
 * ```
 */
export const updateFromStripe = {
  args: {
    stripeSubscriptionId: v.string(),
    status: v.optional(subscriptionStatusValidator),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
    planId: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Subscription updates
   * @returns Subscription document ID
   * @throws Error if subscription not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      stripeSubscriptionId: string;
      status?: string;
      currentPeriodStart?: number;
      currentPeriodEnd?: number;
      cancelAtPeriodEnd?: boolean;
      cancelledAt?: number;
      planId?: string;
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
      throw new Error(`Subscription not found: ${args.stripeSubscriptionId}`);
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.status !== undefined) updates.status = args.status;
    if (args.currentPeriodStart !== undefined) updates.currentPeriodStart = args.currentPeriodStart;
    if (args.currentPeriodEnd !== undefined) updates.currentPeriodEnd = args.currentPeriodEnd;
    if (args.cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = args.cancelAtPeriodEnd;
    if (args.cancelledAt !== undefined) updates.cancelledAt = args.cancelledAt;
    if (args.planId !== undefined) updates.planId = args.planId;

    await db.patch(subscription._id, updates);
    return subscription._id;
  },
};

/**
 * Gets all subscriptions for an email address.
 * Optionally filter to only active subscriptions.
 * 
 * @example
 * ```ts
 * // Get all subscriptions
 * const allSubs = await subscriptions.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 * });
 * 
 * // Get only active subscriptions
 * const activeSubs = await subscriptions.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 *   activeOnly: true,
 * });
 * ```
 */
export const getByEmail = {
  args: {
    email: v.string(),
    activeOnly: v.optional(v.boolean()),
  },
  /**
   * @param ctx - Convex query context
   * @param args - Email and optional active filter
   * @returns Array of subscription documents
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; activeOnly?: boolean }
  ) => {
    const db = ctx.db as any;
    const subscriptions = await db
      .query("sc_subscriptions")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    if (args.activeOnly) {
      return subscriptions.filter(
        (s: any) => s.status === "active" || s.status === "trialing"
      );
    }
    return subscriptions;
  },
};

/**
 * Gets a subscription by Stripe subscription ID.
 * 
 * @example
 * ```ts
 * const subscription = await subscriptions.getByStripeId.handler(ctx, {
 *   stripeSubscriptionId: "sub_1234567890",
 * });
 * ```
 */
export const getByStripeId = {
  args: { stripeSubscriptionId: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Stripe subscription ID
   * @returns Subscription document or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { stripeSubscriptionId: string }
  ) => {
    const db = ctx.db as any;
    return await db
      .query("sc_subscriptions")
      .withIndex("by_stripe_subscription", (q: any) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
  },
};

/**
 * Checks if an email has an active subscription to a plan.
 * 
 * @example
 * ```ts
 * // Check for any active subscription
 * const hasAnySub = await subscriptions.hasActivePlan.handler(ctx, {
 *   email: "customer@example.com",
 * });
 * 
 * // Check for specific plan
 * const hasProPlan = await subscriptions.hasActivePlan.handler(ctx, {
 *   email: "customer@example.com",
 *   planId: "pro",
 * });
 * ```
 */
export const hasActivePlan = {
  args: {
    email: v.string(),
    planId: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex query context
   * @param args - Email and optional plan ID
   * @returns True if customer has an active subscription (to the specified plan if provided)
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; planId?: string }
  ): Promise<boolean> => {
    const db = ctx.db as any;
    const subscriptions = await db
      .query("sc_subscriptions")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    const activeStatuses = ["active", "trialing"];
    const activeSubscriptions = subscriptions.filter((s: any) =>
      activeStatuses.includes(s.status)
    );

    if (args.planId) {
      return activeSubscriptions.some((s: any) => s.planId === args.planId);
    }
    return activeSubscriptions.length > 0;
  },
};

/**
 * Cancels a subscription.
 * Can cancel immediately or at the end of the billing period.
 * 
 * @example
 * ```ts
 * // Cancel at end of period
 * await subscriptions.cancel.handler(ctx, {
 *   stripeSubscriptionId: "sub_1234567890",
 *   cancelAtPeriodEnd: true,
 * });
 * 
 * // Cancel immediately
 * await subscriptions.cancel.handler(ctx, {
 *   stripeSubscriptionId: "sub_1234567890",
 *   cancelAtPeriodEnd: false,
 * });
 * ```
 */
export const cancel = {
  args: {
    stripeSubscriptionId: v.string(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Stripe subscription ID and cancellation mode
   * @returns Subscription document ID
   * @throws Error if subscription not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { stripeSubscriptionId: string; cancelAtPeriodEnd?: boolean }
  ) => {
    const db = ctx.db as any;
    const subscription = await db
      .query("sc_subscriptions")
      .withIndex("by_stripe_subscription", (q: any) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error(`Subscription not found: ${args.stripeSubscriptionId}`);
    }

    const now = Date.now();
    if (args.cancelAtPeriodEnd) {
      await db.patch(subscription._id, {
        cancelAtPeriodEnd: true,
        updatedAt: now,
      });
    } else {
      await db.patch(subscription._id, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      });
    }

    return subscription._id;
  },
};
