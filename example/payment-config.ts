/**
 * Example payment configuration for stripe-convex
 * 
 * This file demonstrates how to define plans and coupons in TypeScript.
 * Import this configuration in your Convex functions and React provider.
 */

import type { Plan, CouponRule, StripeConvexConfig } from "stripe-convex";

/**
 * Define your pricing plans
 */
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with basic features",
    price: 0,
    isSubscription: false,
    features: [
      { id: "projects", name: "Projects", limit: 3 },
      { id: "storage", name: "Storage", description: "100MB included", limit: 100 },
    ],
    sortOrder: 0,
    active: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Everything you need to grow",
    price: 1999, // $19.99/month
    interval: "month",
    isSubscription: true,
    features: [
      { id: "projects", name: "Unlimited Projects", limit: -1 },
      { id: "storage", name: "10GB Storage", limit: 10000 },
      { id: "priority-support", name: "Priority Support" },
      { id: "api-access", name: "API Access", limit: 10000 },
    ],
    sortOrder: 1,
    active: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For teams with advanced needs",
    price: 9999, // $99.99/month
    interval: "month",
    isSubscription: true,
    features: [
      { id: "projects", name: "Unlimited Projects", limit: -1 },
      { id: "storage", name: "100GB Storage", limit: 100000 },
      { id: "priority-support", name: "24/7 Priority Support" },
      { id: "api-access", name: "Unlimited API Access", limit: -1 },
      { id: "sso", name: "SSO/SAML" },
      { id: "audit-logs", name: "Audit Logs" },
    ],
    sortOrder: 2,
    active: true,
  },
  {
    id: "lifetime",
    name: "Lifetime Deal",
    description: "One-time payment, forever access to Pro features",
    price: 29999, // $299.99 one-time
    isSubscription: false,
    features: [
      { id: "projects", name: "Unlimited Projects", limit: -1 },
      { id: "storage", name: "10GB Storage", limit: 10000 },
      { id: "priority-support", name: "Priority Support" },
      { id: "api-access", name: "API Access", limit: 10000 },
    ],
    sortOrder: 3,
    active: true,
  },
];

/**
 * Define your coupon rules
 */
export const coupons: CouponRule[] = [
  // Welcome discount for new customers
  {
    code: "WELCOME20",
    discountType: "percentage",
    discountValue: 20,
    description: "20% off your first purchase",
    maxUsesPerEmail: 1,
    active: true,
  },
  
  // Fixed amount discount
  {
    code: "SAVE10",
    discountType: "fixed",
    discountValue: 1000, // $10 off
    description: "$10 off any order",
    minOrderAmount: 2000, // Minimum $20 order
    active: true,
  },
  
  // Limited time offer
  {
    code: "HOLIDAY50",
    discountType: "percentage",
    discountValue: 50,
    description: "50% off - Holiday Special",
    expiresAt: "2025-12-31",
    maxUses: 100,
    active: true,
  },
  
  // Subscription-only discount
  {
    code: "PROSUB30",
    discountType: "percentage",
    discountValue: 30,
    description: "30% off Pro subscription",
    subscriptionOnly: true,
    applicablePlans: ["pro"],
    active: true,
  },
  
  // Enterprise discount
  {
    code: "ENTERPRISE25",
    discountType: "percentage",
    discountValue: 25,
    description: "25% off Enterprise plan",
    applicablePlans: ["enterprise"],
    maxUsesPerEmail: 1,
    active: true,
  },
  
  // Referral code (unlimited uses, 15% off)
  {
    code: "FRIEND15",
    discountType: "percentage",
    discountValue: 15,
    description: "15% off - Referred by a friend",
    active: true,
  },
];

/**
 * Combined configuration for the provider
 */
export const config: StripeConvexConfig = {
  plans,
  coupons,
  currency: "usd",
  successUrl: process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/success` 
    : "http://localhost:3000/success",
  cancelUrl: process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/pricing` 
    : "http://localhost:3000/pricing",
};

/**
 * Helper to get a plan by ID
 */
export function getPlan(planId: string): Plan | undefined {
  return plans.find(p => p.id === planId);
}

/**
 * Helper to get active plans for pricing page
 */
export function getActivePlans(): Plan[] {
  return plans.filter(p => p.active).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Helper to format price for display
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
