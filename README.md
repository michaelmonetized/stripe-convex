# stripe-convex

A reusable Stripe + Convex payment system with email-based tracking, cart functionality, and TypeScript-first coupon system.

## Features

- 📧 **Email-based tracking** - Track payments and subscriptions by email, not user ID
- 🛒 **Full cart system** - Add/remove items, quantity controls, cart persistence
- 💳 **One-time & subscription payments** - Support both payment types
- 🎟️ **TypeScript coupon system** - Define coupon rules in code with full type safety
- ⚛️ **React components** - Drop-in components for checkout flows
- 🔒 **Secure webhooks** - Idempotent webhook handling with event logging
- 🎯 **Access control** - Check feature/plan access by email

## Installation

```bash
npm install stripe-convex
# or
bun add stripe-convex
# or
pnpm add stripe-convex
```

## Quick Start

### 1. Add schema to your Convex project

```typescript
// convex/schema.ts
import { defineSchema } from "convex/server";
import { stripeConvexTables } from "stripe-convex/convex";

export default defineSchema({
  // Your existing tables...
  
  // Spread stripe-convex tables
  ...stripeConvexTables,
});
```

### 2. Define your plans and coupons

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
    price: 19999, // $199.99
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
    description: "$10 off any order",
    minOrderAmount: 2000, // Minimum $20 order
    expiresAt: "2025-12-31",
  },
  {
    code: "PROSUB",
    discountType: "percentage",
    discountValue: 50,
    description: "50% off Pro subscription",
    subscriptionOnly: true,
    applicablePlans: ["pro"],
    maxUses: 100,
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

### 3. Create Convex functions

```typescript
// convex/stripe.ts
import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import {
  createCheckoutSession,
  verifyWebhookSignature,
  processWebhookEvent,
  webhooks,
  access,
  coupons,
} from "stripe-convex/convex";
import { config, plans } from "../lib/payment-config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Checkout action
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

// Access check query
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
    return result.hasAccess;
  },
});

// Coupon usage query
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
```

### 4. Create webhook handler

```typescript
// convex/http.ts (or your webhook route)
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import Stripe from "stripe";
import { verifyWebhookSignature, processWebhookEvent, webhooks } from "stripe-convex/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    try {
      const event = verifyWebhookSignature(
        stripe,
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      // Check idempotency
      const processed = await ctx.runMutation(webhooks.hasProcessedEvent, {
        stripeEventId: event.id,
      });
      if (processed) {
        return new Response("Already processed", { status: 200 });
      }

      // Record event
      await ctx.runMutation(webhooks.recordEvent, {
        stripeEventId: event.id,
        type: event.type,
        data: event.data.object,
      });

      // Process event
      const eventData = processWebhookEvent(event);
      if (eventData) {
        switch (event.type) {
          case "checkout.session.completed":
            await ctx.runMutation(webhooks.processCheckoutCompleted, eventData.data);
            break;
          case "customer.subscription.updated":
            await ctx.runMutation(webhooks.processSubscriptionUpdate, eventData.data);
            break;
          case "customer.subscription.deleted":
            await ctx.runMutation(webhooks.processSubscriptionDeleted, eventData.data);
            break;
          case "charge.refunded":
            await ctx.runMutation(webhooks.processRefund, eventData.data);
            break;
        }
      }

      // Mark processed
      await ctx.runMutation(webhooks.markProcessed, { stripeEventId: event.id });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Webhook error", { status: 400 });
    }
  }),
});

export default http;
```

### 5. Set up React provider

```tsx
// app/providers.tsx
"use client";

import { StripeConvexProvider } from "stripe-convex";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { config } from "../lib/payment-config";

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const checkoutMutation = useMutation(api.stripe.checkout);
  const checkAccessQuery = useQuery(api.stripe.checkAccess);
  const getCouponUsage = useQuery(api.stripe.getCouponUsage);

  return (
    <StripeConvexProvider
      config={config}
      onCheckout={async (cart) => {
        const result = await checkoutMutation({
          email: cart.email!,
          items: cart.items,
          couponCode: cart.appliedCoupon?.code,
          discountAmount: cart.appliedCoupon?.discountAmount,
        });
        return result;
      }}
      onCheckAccess={async (params) => {
        // Use a query wrapper or action here
        return false; // Implement based on your setup
      }}
      onGetCouponUsage={async (code, email) => {
        // Use a query wrapper or action here
        return { total: 0, email: 0 }; // Implement based on your setup
      }}
    >
      {children}
    </StripeConvexProvider>
  );
}
```

## Component Usage

### Pay Button (Quick Checkout)

```tsx
import { Pay } from "stripe-convex";

// One-time payment
<Pay amount={1999}>
  Buy Now - $19.99
</Pay>

// Subscription
<Pay amount={999} subscription planId="pro">
  Subscribe - $9.99/month
</Pay>
```

### Add to Cart

```tsx
import {
  AddToCart,
  CartItemTitle,
  CartItemPrice,
  CartItemDescription,
  CartItemButton,
} from "stripe-convex";

<AddToCart>
  <CartItemTitle>Premium Widget</CartItemTitle>
  <CartItemPrice price={2999} />
  <CartItemDescription>
    A fantastic widget that does amazing things
  </CartItemDescription>
  <CartItemButton>Add to Cart</CartItemButton>
</AddToCart>
```

### Cart Display

```tsx
import { Cart } from "stripe-convex";

<Cart 
  emptyMessage={<p>Your cart is empty. Start shopping!</p>}
/>
```

### Checkout Form

```tsx
import { Checkout } from "stripe-convex";

<Checkout>
  Complete Purchase
</Checkout>
```

### Feature/Plan Gating

```tsx
import { Has } from "stripe-convex";

// Show only to pro plan subscribers
<Has plan="pro" user="user@example.com">
  <PremiumFeature />
</Has>

// Show only if user has specific feature
<Has feature="api-access" user="user@example.com" fallback={<UpgradePrompt />}>
  <ApiDashboard />
</Has>
```

### Using Hooks

```tsx
import { useCart, useCoupon, useCheckout, useHasAccess } from "stripe-convex";

function MyComponent() {
  const { cart, addToCart, removeFromCart } = useCart();
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();
  const { checkout, setEmail } = useCheckout();
  const { hasAccess, loading } = useHasAccess({ 
    plan: "pro", 
    user: "user@example.com" 
  });

  // Use the values...
}
```

## Coupon System

Define coupons with full TypeScript type safety:

```typescript
const coupons: CouponRule[] = [
  // Percentage discount
  {
    code: "HALF50",
    discountType: "percentage",
    discountValue: 50,
    description: "50% off",
  },

  // Fixed amount discount
  {
    code: "FLAT10",
    discountType: "fixed",
    discountValue: 1000, // $10 in cents
  },

  // With expiration
  {
    code: "HOLIDAY",
    discountType: "percentage",
    discountValue: 25,
    expiresAt: "2025-01-01",
  },

  // Usage limits
  {
    code: "LIMITED",
    discountType: "percentage",
    discountValue: 30,
    maxUses: 100,           // Global limit
    maxUsesPerEmail: 1,     // Per-user limit
  },

  // Minimum order
  {
    code: "SPEND50",
    discountType: "fixed",
    discountValue: 1500,
    minOrderAmount: 5000,   // Minimum $50 order
  },

  // Plan-specific
  {
    code: "PROONLY",
    discountType: "percentage",
    discountValue: 20,
    applicablePlans: ["pro", "enterprise"],
  },

  // Subscription/one-time only
  {
    code: "SUBONLY",
    discountType: "percentage",
    discountValue: 15,
    subscriptionOnly: true,
  },
];
```

## API Reference

### Types

- `Plan` - Plan definition with features
- `PlanFeature` - Feature definition with optional limits
- `CouponRule` - Coupon configuration
- `Cart` - Cart state
- `CartItem` - Individual cart item
- `Payment` - Payment record
- `Subscription` - Subscription record
- `Order` - Order record

### Components

- `StripeConvexProvider` - Context provider
- `Pay` - Quick payment button
- `AddToCart` - Compound component for adding items
- `Cart` - Cart display with controls
- `Checkout` - Checkout form
- `Has` - Conditional rendering based on access

### Hooks

- `useStripeConvex()` - Full context access
- `useCart()` - Cart operations
- `useCoupon()` - Coupon operations  
- `useCheckout()` - Checkout operations
- `useHasAccess()` - Access check hook

### Convex Exports

- `stripeConvexTables` - Schema tables to spread
- `customers`, `payments`, `subscriptions`, `orders`, `coupons`, `access`, `webhooks` - Function handlers
- `createCheckoutSession`, `createPaymentIntent`, etc. - Stripe utilities

## License

MIT
