/**
 * @module stripe-convex/convex/coupons
 * @description Coupon validation, calculation, and usage tracking utilities
 */

import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import type { CouponRule, AppliedCoupon } from "../types/index.js";

/**
 * Validates a coupon against order parameters and usage limits.
 * 
 * Checks performed:
 * - Coupon is active
 * - Not expired
 * - Global usage limit not reached
 * - Per-email usage limit not reached
 * - Minimum order amount met
 * - Subscription/one-time restrictions
 * - Plan restrictions
 * 
 * @param coupon - Coupon rule to validate
 * @param params - Order parameters and usage counts
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```ts
 * const result = validateCoupon(couponRule, {
 *   email: "customer@example.com",
 *   orderAmount: 5000, // $50.00
 *   isSubscription: false,
 *   currentUsage: 5,
 *   emailUsage: 0,
 * });
 * 
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateCoupon(
  coupon: CouponRule,
  params: {
    /** Customer email */
    email: string;
    /** Order amount in cents */
    orderAmount: number;
    /** Whether order contains subscriptions */
    isSubscription: boolean;
    /** Plan ID if applicable */
    planId?: string;
    /** Current global usage count */
    currentUsage: number;
    /** Usage count for this email */
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
 * Calculates the discount amount for a coupon.
 * 
 * For percentage discounts, calculates the percentage of the order amount.
 * For fixed discounts, returns the fixed amount (capped at order amount).
 * 
 * @param coupon - Coupon rule
 * @param orderAmount - Order amount in cents
 * @returns Discount amount in cents
 * 
 * @example
 * ```ts
 * // 20% off $50 order = $10 discount
 * const discount = calculateDiscount(
 *   { code: "SAVE20", discountType: "percentage", discountValue: 20 },
 *   5000
 * ); // Returns 1000
 * 
 * // $15 off $10 order = $10 discount (capped)
 * const discount2 = calculateDiscount(
 *   { code: "FLAT15", discountType: "fixed", discountValue: 1500 },
 *   1000
 * ); // Returns 1000
 * ```
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
 * Validates a coupon and returns the applied coupon details.
 * Combines validateCoupon and calculateDiscount into a single call.
 * 
 * @param coupon - Coupon rule
 * @param params - Order parameters and usage counts
 * @returns Applied coupon details or error object
 * 
 * @example
 * ```ts
 * const result = applyCouponToOrder(couponRule, {
 *   email: "customer@example.com",
 *   orderAmount: 5000,
 *   isSubscription: false,
 *   currentUsage: 0,
 *   emailUsage: 0,
 * });
 * 
 * if ("error" in result) {
 *   console.error(result.error);
 * } else {
 *   console.log(`Discount: ${result.discountAmount}`);
 * }
 * ```
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

/**
 * Formats cents as a currency string.
 * @internal
 */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Records a coupon usage in the database.
 * Call this after a successful order to track usage limits.
 */
export const recordUsage = {
  args: {
    code: v.string(),
    email: v.string(),
    orderId: v.id("sc_orders"),
    discountAmount: v.number(),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Coupon usage details
   * @returns ID of the created usage record
   */
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
 * Gets the global usage count for a coupon code.
 */
export const getUsageCount = {
  args: { code: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Coupon code
   * @returns Total number of times coupon has been used
   */
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
 * Gets the usage count for a coupon code by a specific email.
 */
export const getEmailUsageCount = {
  args: {
    code: v.string(),
    email: v.string(),
  },
  /**
   * @param ctx - Convex query context
   * @param args - Coupon code and email
   * @returns Number of times this email has used this coupon
   */
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
