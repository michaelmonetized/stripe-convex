import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import { subscriptionStatusValidator } from "./schema.js";

/**
 * Create a new subscription record
 */
export const create = {
  args: {
    email: v.string(),
    planId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    metadata: v.optional(v.any()),
  },
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
 * Update subscription from Stripe webhook
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
 * Get subscriptions by email
 */
export const getByEmail = {
  args: {
    email: v.string(),
    activeOnly: v.optional(v.boolean()),
  },
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
 * Get subscription by Stripe subscription ID
 */
export const getByStripeId = {
  args: { stripeSubscriptionId: v.string() },
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
 * Check if email has active subscription to a plan
 */
export const hasActivePlan = {
  args: {
    email: v.string(),
    planId: v.optional(v.string()),
  },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; planId?: string }
  ) => {
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
 * Cancel subscription
 */
export const cancel = {
  args: {
    stripeSubscriptionId: v.string(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
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
