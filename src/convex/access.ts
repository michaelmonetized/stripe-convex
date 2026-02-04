import { v } from "convex/values";
import type { GenericQueryCtx, GenericDataModel } from "convex/server";
import type { Plan, PlanFeature } from "../types/index.js";

/**
 * Check if an email has access to a feature or plan
 */
export const checkAccess = {
  args: {
    email: v.string(),
    feature: v.optional(v.string()),
    plan: v.optional(v.string()),
    plans: v.optional(v.any()), // Plans configuration
  },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; feature?: string; plan?: string; plans?: Plan[] }
  ) => {
    const db = ctx.db as any;

    // Get active subscriptions for this email
    const subscriptions = await db
      .query("sc_subscriptions")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    const activeSubscriptions = subscriptions.filter(
      (s: any) => s.status === "active" || s.status === "trialing"
    );

    // Get successful payments
    const payments = await db
      .query("sc_payments")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    const successfulPayments = payments.filter(
      (p: any) => p.status === "succeeded"
    );

    // Check plan access
    if (args.plan) {
      // Check if they have an active subscription to this plan
      const hasPlanSubscription = activeSubscriptions.some(
        (s: any) => s.planId === args.plan
      );
      if (hasPlanSubscription) {
        return { hasAccess: true, reason: "active_subscription" };
      }

      // Check if they have a one-time payment for this plan
      const hasPlanPayment = successfulPayments.some(
        (p: any) => p.metadata?.planId === args.plan
      );
      if (hasPlanPayment) {
        return { hasAccess: true, reason: "one_time_payment" };
      }

      return { hasAccess: false, reason: "no_plan_access" };
    }

    // Check feature access
    if (args.feature && args.plans) {
      // Find which plans include this feature
      const plansWithFeature = args.plans.filter((p: Plan) =>
        p.features.some((f: PlanFeature) => f.id === args.feature)
      );

      if (plansWithFeature.length === 0) {
        return { hasAccess: false, reason: "feature_not_found" };
      }

      // Check if user has any of these plans
      for (const plan of plansWithFeature) {
        const hasPlanAccess =
          activeSubscriptions.some((s: any) => s.planId === plan.id) ||
          successfulPayments.some((p: any) => p.metadata?.planId === plan.id);

        if (hasPlanAccess) {
          return { hasAccess: true, reason: "has_plan_with_feature" };
        }
      }

      return { hasAccess: false, reason: "no_feature_access" };
    }

    // If no specific check, just return if they have any active subscription or payment
    if (activeSubscriptions.length > 0) {
      return { hasAccess: true, reason: "has_active_subscription" };
    }
    if (successfulPayments.length > 0) {
      return { hasAccess: true, reason: "has_payment" };
    }

    return { hasAccess: false, reason: "no_access" };
  },
};

/**
 * Get user's current plan(s) with features
 */
export const getUserPlans = {
  args: {
    email: v.string(),
    plans: v.optional(v.any()),
  },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; plans?: Plan[] }
  ) => {
    const db = ctx.db as any;

    const subscriptions = await db
      .query("sc_subscriptions")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    const activeSubscriptions = subscriptions.filter(
      (s: any) => s.status === "active" || s.status === "trialing"
    );

    if (!args.plans) {
      return activeSubscriptions.map((s: any) => ({
        planId: s.planId,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
      }));
    }

    return activeSubscriptions.map((s: any) => {
      const planConfig = args.plans!.find((p: Plan) => p.id === s.planId);
      return {
        planId: s.planId,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
        plan: planConfig || null,
      };
    });
  },
};

/**
 * Get all features user has access to
 */
export const getUserFeatures = {
  args: {
    email: v.string(),
    plans: v.any(),
  },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; plans: Plan[] }
  ) => {
    const db = ctx.db as any;

    // Get active subscriptions
    const subscriptions = await db
      .query("sc_subscriptions")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    const activeSubscriptions = subscriptions.filter(
      (s: any) => s.status === "active" || s.status === "trialing"
    );

    // Get successful payments
    const payments = await db
      .query("sc_payments")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    const successfulPayments = payments.filter(
      (p: any) => p.status === "succeeded"
    );

    // Collect all features from user's plans
    const features = new Map<string, PlanFeature>();

    for (const plan of args.plans) {
      const hasAccess =
        activeSubscriptions.some((s: any) => s.planId === plan.id) ||
        successfulPayments.some((p: any) => p.metadata?.planId === plan.id);

      if (hasAccess) {
        for (const feature of plan.features) {
          const existing = features.get(feature.id);
          if (!existing || (feature.limit && (!existing.limit || feature.limit > existing.limit))) {
            features.set(feature.id, feature);
          }
        }
      }
    }

    return Array.from(features.values());
  },
};
