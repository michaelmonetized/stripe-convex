# stripe-convex

A complete Stripe + Convex payment system with email-based tracking, full cart functionality, and TypeScript-first coupon system.

[![npm version](https://img.shields.io/npm/v/stripe-convex.svg)](https://www.npmjs.com/package/stripe-convex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📧 **Email-based tracking** - Track payments and subscriptions by email, no user ID required
- 🛒 **Full cart system** - Add/remove items, quantity controls, persistent cart state
- 💳 **One-time & subscriptions** - Support both payment types with a unified API
- 🎟️ **TypeScript coupon system** - Define coupon rules in code with full type safety
- ⚛️ **React components** - Drop-in components for checkout flows
- 🔒 **Secure webhooks** - Idempotent webhook handling with event logging
- 🎯 **Access control** - Check feature/plan access by email
- 📦 **Zero config schema** - Just spread the tables into your Convex schema

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

## Quick Example

```tsx
import { StripeConvexProvider, Pay, Cart, Checkout, Has } from "stripe-convex";

// Quick payment button
<Pay amount={1999}>Buy Now - $19.99</Pay>

// Subscription
<Pay amount={999} subscription planId="pro">
  Subscribe - $9.99/month
</Pay>

// Full cart + checkout
<Cart />
<Checkout>Complete Purchase</Checkout>

// Feature gating
<Has plan="pro" user="user@example.com">
  <PremiumFeature />
</Has>
```

## Documentation

| Guide | Description |
|-------|-------------|
| [**Getting Started**](./docs/getting-started.md) | Installation, setup, and configuration |
| [**Components**](./docs/components.md) | React components (Pay, AddToCart, Cart, Checkout, Has) |
| [**Hooks**](./docs/hooks.md) | React hooks (useCart, useCoupon, useCheckout, useHasAccess) |
| [**Convex Functions**](./docs/convex-functions.md) | Server-side functions and Stripe utilities |
| [**Coupons**](./docs/coupons.md) | TypeScript-first coupon system |
| [**Webhooks**](./docs/webhooks.md) | Stripe webhook handling |
| [**Examples**](./docs/examples.md) | Complete usage examples |

## API Overview

### React Components

| Component | Description |
|-----------|-------------|
| `StripeConvexProvider` | Context provider for the app |
| `Pay` | Quick payment button |
| `AddToCart` | Compound component for adding items |
| `Cart` | Cart display with controls |
| `Checkout` | Checkout form with email input |
| `Has` | Conditional rendering based on access |

### React Hooks

| Hook | Description |
|------|-------------|
| `useStripeConvex()` | Full context access |
| `useCart()` | Cart operations |
| `useCoupon()` | Coupon operations |
| `useCheckout()` | Checkout operations |
| `useHasAccess()` | Access check hook |

### Convex Exports

```typescript
import {
  // Schema
  stripeConvexTables,
  
  // Function handlers
  customers, payments, subscriptions, orders, coupons, access, webhooks,
  
  // Stripe utilities
  createCheckoutSession, createPaymentIntent, createSubscription,
  cancelSubscription, getSubscription,
  verifyWebhookSignature, processWebhookEvent,
  
  // Coupon utilities
  validateCoupon, calculateDiscount, applyCouponToOrder,
} from "stripe-convex/convex";
```

### TypeScript Types

```typescript
import type {
  Plan, PlanFeature, CouponRule, AppliedCoupon,
  Cart, CartItem, Payment, Subscription, Order, Customer,
  StripeConvexConfig, StripeConvexContextValue,
} from "stripe-convex";
```

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

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## License

MIT © Michael Shilman
