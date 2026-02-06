/**
 * Example Convex functions for stripe-convex
 * 
 * Copy this file to your convex/ directory and customize as needed.
 * File: convex/stripe.ts
 */

import { action, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import {
  createCheckoutSession,
  verifyWebhookSignature,
  processWebhookEvent,
  webhooks,
  access,
  coupons,
  customers,
  subscriptions,
  payments,
} from "stripe-convex/convex";
import { config, plans, getPlan } from "../lib/payment-config";

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// ============================================
// CHECKOUT
// ============================================

/**
 * Create a Stripe Checkout session
 */
export const checkout = action({
  args: {
    email: v.string(),
    items: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        price: v.number(),
        quantity: v.number(),
        planId: v.optional(v.string()),
        isSubscription: v.optional(v.boolean()),
      })
    ),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const isSubscription = args.items.some((i) => i.isSubscription);
    const planId = args.items[0]?.planId;

    const session = await createCheckoutSession(stripe, {
      email: args.email,
      items: args.items,
      successUrl: config.successUrl!,
      cancelUrl: config.cancelUrl!,
      isSubscription,
      planId,
      coupon: args.couponCode
        ? {
            code: args.couponCode,
            discountType: "fixed",
            discountValue: args.discountAmount || 0,
            discountAmount: args.discountAmount || 0,
          }
        : undefined,
    });

    return { url: session.url };
  },
});

/**
 * Quick checkout for a single plan
 */
export const quickCheckout = action({
  args: {
    email: v.string(),
    planId: v.string(),
  },
  handler: async (ctx, args) => {
    const plan = getPlan(args.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${args.planId}`);
    }

    const session = await createCheckoutSession(stripe, {
      email: args.email,
      items: [
        {
          id: plan.id,
          title: plan.name,
          description: plan.description,
          price: plan.price,
          quantity: 1,
          planId: plan.id,
          isSubscription: plan.isSubscription,
        },
      ],
      successUrl: config.successUrl!,
      cancelUrl: config.cancelUrl!,
      isSubscription: plan.isSubscription,
      planId: plan.id,
    });

    return { url: session.url };
  },
});

// ============================================
// ACCESS CONTROL
// ============================================

/**
 * Check if user has access to a feature or plan
 */
export const checkAccess = query({
  args: {
    email: v.string(),
    feature: v.optional(v.string()),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await access.checkAccess.handler(ctx, {
      email: args.email,
      feature: args.feature,
      plan: args.plan,
      plans,
    });
    return result;
  },
});

/**
 * Get user's active plans
 */
export const getUserPlans = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await access.getUserPlans.handler(ctx, {
      email: args.email,
      plans,
    });
  },
});

/**
 * Get all features user has access to
 */
export const getUserFeatures = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await access.getUserFeatures.handler(ctx, {
      email: args.email,
      plans,
    });
  },
});

// ============================================
// SUBSCRIPTIONS
// ============================================

/**
 * Get subscriptions for a user
 */
export const getSubscriptions = query({
  args: {
    email: v.string(),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await subscriptions.getByEmail.handler(ctx, args);
  },
});

/**
 * Cancel a subscription
 */
export const cancelSubscription = action({
  args: {
    stripeSubscriptionId: v.string(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Cancel in Stripe
    const { cancelSubscription: stripeCancelSubscription } = await import(
      "stripe-convex/convex"
    );
    await stripeCancelSubscription(
      stripe,
      args.stripeSubscriptionId,
      args.cancelAtPeriodEnd ?? true
    );

    // Update in Convex
    await ctx.runMutation(internal.stripe.updateSubscriptionStatus, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? true,
    });

    return { success: true };
  },
});

// Internal mutation for updating subscription
export const updateSubscriptionStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await subscriptions.cancel.handler(ctx, args);
  },
});

// ============================================
// COUPONS
// ============================================

/**
 * Validate and get coupon usage
 */
export const getCouponUsage = query({
  args: {
    code: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const total = await coupons.getUsageCount.handler(ctx, { code: args.code });
    const email = await coupons.getEmailUsageCount.handler(ctx, args);
    return { total, email };
  },
});

// ============================================
// PAYMENTS
// ============================================

/**
 * Get payment history for a user
 */
export const getPayments = query({
  args: {
    email: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("succeeded"),
        v.literal("failed"),
        v.literal("refunded"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    return await payments.getByEmail.handler(ctx, args);
  },
});

// ============================================
// CUSTOMER
// ============================================

/**
 * Get or create customer
 */
export const getCustomer = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await customers.getByEmail.handler(ctx, args);
  },
});

// Namespace for internal mutations
const internal = {
  stripe: {
    updateSubscriptionStatus: "stripe:updateSubscriptionStatus" as any,
  },
};
