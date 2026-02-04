import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import type { CouponRule, AppliedCoupon } from "../types/index.js";

/**
 * Validate and apply a coupon code
 * Returns the applied coupon details or null if invalid
 */
export function validateCoupon(
  coupon: CouponRule,
  params: {
    email: string;
    orderAmount: number;
    isSubscription: boolean;
    planId?: string;
    currentUsage: number;
    emailUsage: number;
  }
): { valid: boolean; error?: string } {
  // Check if coupon is active
  if (coupon.active === false) {
    return { valid: false, error: "Coupon is not active" };
  }

  // Check expiration
  if (coupon.expiresAt) {
    const expiryTime =
      typeof coupon.expiresAt === "string"
        ? new Date(coupon.expiresAt).getTime()
        : coupon.expiresAt;
    if (Date.now() > expiryTime) {
      return { valid: false, error: "Coupon has expired" };
    }
  }

  // Check max global uses
  if (coupon.maxUses !== undefined && params.currentUsage >= coupon.maxUses) {
    return { valid: false, error: "Coupon usage limit reached" };
  }

  // Check max uses per email
  if (
    coupon.maxUsesPerEmail !== undefined &&
    params.emailUsage >= coupon.maxUsesPerEmail
  ) {
    return { valid: false, error: "You have already used this coupon" };
  }

  // Check minimum order amount
  if (
    coupon.minOrderAmount !== undefined &&
    params.orderAmount < coupon.minOrderAmount
  ) {
    return {
      valid: false,
      error: `Minimum order amount is ${formatCents(coupon.minOrderAmount)}`,
    };
  }

  // Check subscription/one-time restrictions
  if (coupon.subscriptionOnly && !params.isSubscription) {
    return { valid: false, error: "Coupon only valid for subscriptions" };
  }
  if (coupon.oneTimeOnly && params.isSubscription) {
    return { valid: false, error: "Coupon only valid for one-time purchases" };
  }

  // Check applicable plans
  if (coupon.applicablePlans && coupon.applicablePlans.length > 0) {
    if (!params.planId || !coupon.applicablePlans.includes(params.planId)) {
      return { valid: false, error: "Coupon not valid for this plan" };
    }
  }

  return { valid: true };
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
  coupon: CouponRule,
  orderAmount: number
): number {
  if (coupon.discountType === "percentage") {
    return Math.round((orderAmount * coupon.discountValue) / 100);
  } else {
    // Fixed amount - don't exceed order amount
    return Math.min(coupon.discountValue, orderAmount);
  }
}

/**
 * Apply coupon and get result
 */
export function applyCouponToOrder(
  coupon: CouponRule,
  params: {
    email: string;
    orderAmount: number;
    isSubscription: boolean;
    planId?: string;
    currentUsage: number;
    emailUsage: number;
  }
): AppliedCoupon | { error: string } {
  const validation = validateCoupon(coupon, params);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  const discountAmount = calculateDiscount(coupon, params.orderAmount);

  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount,
    description: coupon.description,
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Record coupon usage
 */
export const recordUsage = {
  args: {
    code: v.string(),
    email: v.string(),
    orderId: v.id("sc_orders"),
    discountAmount: v.number(),
  },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { code: string; email: string; orderId: any; discountAmount: number }
  ) => {
    const db = ctx.db as any;
    return await db.insert("sc_coupon_usage", {
      code: args.code,
      email: args.email,
      orderId: args.orderId,
      discountAmount: args.discountAmount,
      usedAt: Date.now(),
    });
  },
};

/**
 * Get coupon usage count
 */
export const getUsageCount = {
  args: { code: v.string() },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { code: string }
  ) => {
    const db = ctx.db as any;
    const usages = await db
      .query("sc_coupon_usage")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .collect();
    return usages.length;
  },
};

/**
 * Get coupon usage count for specific email
 */
export const getEmailUsageCount = {
  args: {
    code: v.string(),
    email: v.string(),
  },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { code: string; email: string }
  ) => {
    const db = ctx.db as any;
    const usages = await db
      .query("sc_coupon_usage")
      .withIndex("by_code_email", (q: any) =>
        q.eq("code", args.code).eq("email", args.email)
      )
      .collect();
    return usages.length;
  },
};
