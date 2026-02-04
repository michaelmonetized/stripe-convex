# Getting Started

This guide will walk you through setting up stripe-convex in your project.

## Installation

```bash
npm install stripe-convex
# or
bun add stripe-convex
# or
pnpm add stripe-convex
```

### Peer Dependencies

```bash
npm install convex stripe react
```

## Quick Setup

### 1. Add Schema to Your Convex Project

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { stripeConvexTables } from "stripe-convex/convex";

export default defineSchema({
  // Your existing tables...
  users: defineTable({ /* ... */ }),
  
  // Add stripe-convex tables (prefixed with sc_)
  ...stripeConvexTables,
});
```

### 2. Define Your Plans and Coupons

```typescript
// lib/payment-config.ts
import type { Plan, CouponRule, StripeConvexConfig } from "stripe-convex";

export const plans: Plan[] = [
  {
    id: "pro",
    name: "Pro Plan",
    description: "All features included",
    price: 1999, // $19.99 in cents
    interval: "month",
    isSubscription: true,
    features: [
      { id: "unlimited-projects", name: "Unlimited Projects" },
      { id: "priority-support", name: "Priority Support" },
      { id: "api-access", name: "API Access", limit: 10000 },
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime Access",
    description: "One-time payment, forever access",
    price: 29999, // $299.99
    isSubscription: false,
    features: [
      { id: "unlimited-projects", name: "Unlimited Projects" },
      { id: "priority-support", name: "Priority Support" },
    ],
  },
];

export const coupons: CouponRule[] = [
  {
    code: "WELCOME20",
    discountType: "percentage",
    discountValue: 20,
    description: "20% off your first purchase",
    maxUsesPerEmail: 1,
  },
  {
    code: "SAVE10",
    discountType: "fixed",
    discountValue: 1000, // $10 off
    minOrderAmount: 2000, // Minimum $20 order
  },
];

export const config: StripeConvexConfig = {
  plans,
  coupons,
  currency: "usd",
  successUrl: "https://yoursite.com/success",
  cancelUrl: "https://yoursite.com/cancel",
};
```

### 3. Create Convex Functions

```typescript
// convex/stripe.ts
import { action, query } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { createCheckoutSession, access } from "stripe-convex/convex";
import { config, plans } from "../lib/payment-config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const checkout = action({
  args: {
    email: v.string(),
    items: v.array(v.object({
      id: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      price: v.number(),
      quantity: v.number(),
      planId: v.optional(v.string()),
      isSubscription: v.optional(v.boolean()),
    })),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await createCheckoutSession(stripe, {
      email: args.email,
      items: args.items,
      successUrl: config.successUrl!,
      cancelUrl: config.cancelUrl!,
      isSubscription: args.items.some(i => i.isSubscription),
      planId: args.items[0]?.planId,
      coupon: args.couponCode ? {
        code: args.couponCode,
        discountType: "fixed",
        discountValue: args.discountAmount || 0,
        discountAmount: args.discountAmount || 0,
      } : undefined,
    });
    return { url: session.url };
  },
});

export const checkAccess = query({
  args: {
    email: v.string(),
    feature: v.optional(v.string()),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await access.checkAccess.handler(ctx, {
      email: args.email,
      feature: args.feature,
      plan: args.plan,
      plans,
    });
  },
});
```

### 4. Set Up Webhook Handler

See [Webhooks Documentation](./webhooks.md) for the complete webhook setup.

### 5. Set Up React Provider

```tsx
// app/providers.tsx
"use client";

import { StripeConvexProvider } from "stripe-convex";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { config } from "../lib/payment-config";

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const checkout = useAction(api.stripe.checkout);

  return (
    <StripeConvexProvider
      config={config}
      onCheckout={async (cart) => {
        const result = await checkout({
          email: cart.email!,
          items: cart.items,
          couponCode: cart.appliedCoupon?.code,
          discountAmount: cart.appliedCoupon?.discountAmount,
        });
        return result;
      }}
    >
      {children}
    </StripeConvexProvider>
  );
}
```

## Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# For production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Stripe Dashboard Setup

1. Create products and prices in Stripe Dashboard
2. Set up webhook endpoint: `https://your-app.convex.site/stripe-webhook`
3. Enable these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

## Database Schema

The package creates these tables (prefixed with `sc_`):

| Table | Description |
|-------|-------------|
| `sc_customers` | Customer records indexed by email |
| `sc_payments` | One-time payment records |
| `sc_subscriptions` | Subscription records |
| `sc_orders` | Order records with line items |
| `sc_coupon_usage` | Coupon redemption tracking |
| `sc_webhook_events` | Webhook event log for idempotency |

## Next Steps

- [Components](./components.md) - Drop-in React components
- [Hooks](./hooks.md) - React hooks for custom UIs
- [Coupons](./coupons.md) - TypeScript coupon system
- [Examples](./examples.md) - Complete usage examples
