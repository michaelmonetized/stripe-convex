import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema for stripe-convex package.
 * 
 * To use in your project, either:
 * 1. Copy these table definitions to your schema.ts
 * 2. Or import and spread: { ...stripeConvexTables }
 */

export const paymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("refunded"),
  v.literal("cancelled")
);

export const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("past_due"),
  v.literal("cancelled"),
  v.literal("unpaid"),
  v.literal("trialing"),
  v.literal("paused")
);

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("completed"),
  v.literal("refunded"),
  v.literal("cancelled")
);

export const cartItemValidator = v.object({
  id: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  price: v.number(),
  quantity: v.number(),
  metadata: v.optional(v.any()),
  planId: v.optional(v.string()),
  isSubscription: v.optional(v.boolean()),
});

// Table definitions that can be spread into your schema
export const stripeConvexTables = {
  // Customers - indexed by email for quick lookups
  sc_customers: defineTable({
    email: v.string(),
    stripeCustomerId: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // Payments - one-time payments
  sc_payments: defineTable({
    email: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: paymentStatusValidator,
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_stripe_payment_intent", ["stripePaymentIntentId"])
    .index("by_status", ["status"]),

  // Subscriptions
  sc_subscriptions: defineTable({
    email: v.string(),
    planId: v.string(),
    status: subscriptionStatusValidator,
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_plan", ["planId"])
    .index("by_status", ["status"])
    .index("by_email_status", ["email", "status"]),

  // Orders - tracks cart checkouts
  sc_orders: defineTable({
    email: v.string(),
    items: v.array(cartItemValidator),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    couponCode: v.optional(v.string()),
    paymentId: v.optional(v.id("sc_payments")),
    subscriptionId: v.optional(v.id("sc_subscriptions")),
    status: orderStatusValidator,
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  // Coupon usage tracking
  sc_coupon_usage: defineTable({
    code: v.string(),
    email: v.string(),
    orderId: v.id("sc_orders"),
    discountAmount: v.number(),
    usedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_email", ["email"])
    .index("by_code_email", ["code", "email"]),

  // Webhook event log (for idempotency)
  sc_webhook_events: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    data: v.any(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_stripe_event", ["stripeEventId"])
    .index("by_type", ["type"]),
};

// Full schema for standalone use
export default defineSchema(stripeConvexTables);
