/**
 * @module stripe-convex/convex/payments
 * @description Payment record management utilities
 */

import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import { paymentStatusValidator } from "./schema.js";

/**
 * Creates a new payment record.
 * Typically called when initiating a payment flow.
 * 
 * @example
 * ```ts
 * const paymentId = await payments.create.handler(ctx, {
 *   email: "customer@example.com",
 *   amount: 1999, // $19.99
 *   currency: "usd",
 *   stripePaymentIntentId: "pi_1234567890",
 * });
 * ```
 */
export const create = {
  args: {
    email: v.string(),
    amount: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Payment details
   * @returns Payment document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      email: string;
      amount: number;
      currency: string;
      stripePaymentIntentId?: string;
      couponCode?: string;
      discountAmount?: number;
      metadata?: any;
    }
  ) => {
    const db = ctx.db as any;
    const now = Date.now();

    return await db.insert("sc_payments", {
      email: args.email,
      amount: args.amount,
      currency: args.currency,
      status: "pending",
      stripePaymentIntentId: args.stripePaymentIntentId,
      couponCode: args.couponCode,
      discountAmount: args.discountAmount,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
};

/**
 * Updates the status of a payment by Stripe PaymentIntent ID.
 * Called from webhook handlers when payment status changes.
 * 
 * @example
 * ```ts
 * await payments.updateStatus.handler(ctx, {
 *   stripePaymentIntentId: "pi_1234567890",
 *   status: "succeeded",
 *   stripeChargeId: "ch_1234567890",
 * });
 * ```
 */
export const updateStatus = {
  args: {
    stripePaymentIntentId: v.string(),
    status: paymentStatusValidator,
    stripeChargeId: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Payment intent ID and new status
   * @returns Payment document ID
   * @throws Error if payment not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      stripePaymentIntentId: string;
      status: string;
      stripeChargeId?: string;
    }
  ) => {
    const db = ctx.db as any;
    const payment = await db
      .query("sc_payments")
      .withIndex("by_stripe_payment_intent", (q: any) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();

    if (!payment) {
      throw new Error(`Payment not found: ${args.stripePaymentIntentId}`);
    }

    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.stripeChargeId) {
      updates.stripeChargeId = args.stripeChargeId;
    }

    await db.patch(payment._id, updates);
    return payment._id;
  },
};

/**
 * Gets all payments for an email address.
 * Optionally filter by payment status.
 * 
 * @example
 * ```ts
 * // Get all payments
 * const allPayments = await payments.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 * });
 * 
 * // Get only successful payments
 * const successfulPayments = await payments.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 *   status: "succeeded",
 * });
 * ```
 */
export const getByEmail = {
  args: {
    email: v.string(),
    status: v.optional(paymentStatusValidator),
  },
  /**
   * @param ctx - Convex query context
   * @param args - Email and optional status filter
   * @returns Array of payment documents
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; status?: string }
  ) => {
    const db = ctx.db as any;
    let query = db
      .query("sc_payments")
      .withIndex("by_email", (q: any) => q.eq("email", args.email));

    const payments = await query.collect();

    if (args.status) {
      return payments.filter((p: any) => p.status === args.status);
    }
    return payments;
  },
};

/**
 * Gets a payment by Stripe PaymentIntent ID.
 * 
 * @example
 * ```ts
 * const payment = await payments.getByPaymentIntent.handler(ctx, {
 *   stripePaymentIntentId: "pi_1234567890",
 * });
 * ```
 */
export const getByPaymentIntent = {
  args: { stripePaymentIntentId: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Stripe PaymentIntent ID
   * @returns Payment document or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { stripePaymentIntentId: string }
  ) => {
    const db = ctx.db as any;
    return await db
      .query("sc_payments")
      .withIndex("by_stripe_payment_intent", (q: any) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();
  },
};

/**
 * Checks if an email has any successful payments.
 * Useful for basic access control without plan-specific logic.
 * 
 * @example
 * ```ts
 * const hasPaid = await payments.hasSuccessfulPayment.handler(ctx, {
 *   email: "customer@example.com",
 * });
 * if (hasPaid) {
 *   // Grant access
 * }
 * ```
 */
export const hasSuccessfulPayment = {
  args: { email: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Customer email
   * @returns True if customer has at least one successful payment
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string }
  ): Promise<boolean> => {
    const db = ctx.db as any;
    const payments = await db
      .query("sc_payments")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    return payments.some((p: any) => p.status === "succeeded");
  },
};
