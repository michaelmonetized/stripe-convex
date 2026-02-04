import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import { paymentStatusValidator } from "./schema.js";

/**
 * Create a new payment record
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
 * Update payment status
 */
export const updateStatus = {
  args: {
    stripePaymentIntentId: v.string(),
    status: paymentStatusValidator,
    stripeChargeId: v.optional(v.string()),
  },
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
 * Get payments by email
 */
export const getByEmail = {
  args: {
    email: v.string(),
    status: v.optional(paymentStatusValidator),
  },
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
 * Get payment by Stripe payment intent ID
 */
export const getByPaymentIntent = {
  args: { stripePaymentIntentId: v.string() },
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
 * Check if email has any successful payments
 */
export const hasSuccessfulPayment = {
  args: { email: v.string() },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string }
  ) => {
    const db = ctx.db as any;
    const payments = await db
      .query("sc_payments")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    return payments.some((p: any) => p.status === "succeeded");
  },
};
