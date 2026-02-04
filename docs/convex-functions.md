# Convex Functions

stripe-convex provides function handlers for use with Convex. These are designed to be called from your own Convex functions.

## Schema

### stripeConvexTables

Spread into your Convex schema to add the required tables.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { stripeConvexTables } from "stripe-convex/convex";

export default defineSchema({
  // Your tables...
  users: defineTable({ /* ... */ }),
  
  // stripe-convex tables
  ...stripeConvexTables,
});
```

Creates these tables:

| Table | Description | Indexes |
|-------|-------------|---------|
| `sc_customers` | Customer records | `by_email`, `by_stripe_customer` |
| `sc_payments` | One-time payments | `by_email`, `by_stripe_payment_intent` |
| `sc_subscriptions` | Subscriptions | `by_email`, `by_stripe_subscription` |
| `sc_orders` | Order records | `by_email` |
| `sc_coupon_usage` | Coupon redemptions | `by_code`, `by_code_email` |
| `sc_webhook_events` | Webhook event log | `by_stripe_event` |

---

## Stripe Utilities

### createCheckoutSession

Creates a Stripe Checkout Session.

```typescript
import Stripe from "stripe";
import { createCheckoutSession } from "stripe-convex/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const session = await createCheckoutSession(stripe, {
  email: "customer@example.com",
  items: [
    { title: "Widget", price: 1999, quantity: 1 },
  ],
  successUrl: "https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://yoursite.com/cancel",
  
  // Optional
  isSubscription: false,
  planId: "pro",
  coupon: {
    code: "SAVE20",
    discountType: "percentage",
    discountValue: 20,
    discountAmount: 400,
  },
  metadata: { orderId: "123" },
});

// Returns Stripe.Checkout.Session
console.log(session.url); // Redirect user here
```

### createPaymentIntent

Creates a Stripe PaymentIntent for custom payment flows.

```typescript
import { createPaymentIntent } from "stripe-convex/convex";

const paymentIntent = await createPaymentIntent(stripe, {
  amount: 1999,
  currency: "usd",
  customerEmail: "customer@example.com",
  metadata: { productId: "widget-123" },
});

// Returns Stripe.PaymentIntent
console.log(paymentIntent.client_secret);
```

### createSubscription

Creates a Stripe Subscription.

```typescript
import { createSubscription } from "stripe-convex/convex";

const subscription = await createSubscription(stripe, {
  customerId: "cus_xxx",
  priceId: "price_xxx",
  metadata: { planId: "pro" },
});
```

### cancelSubscription

Cancels a Stripe Subscription.

```typescript
import { cancelSubscription } from "stripe-convex/convex";

await cancelSubscription(stripe, {
  subscriptionId: "sub_xxx",
  immediately: false, // Cancel at period end
});
```

### getSubscription

Retrieves a Stripe Subscription.

```typescript
import { getSubscription } from "stripe-convex/convex";

const subscription = await getSubscription(stripe, {
  subscriptionId: "sub_xxx",
});
```

### verifyWebhookSignature

Verifies a Stripe webhook signature.

```typescript
import { verifyWebhookSignature } from "stripe-convex/convex";

const event = verifyWebhookSignature(
  stripe,
  requestBody,      // Raw request body string
  signature,        // stripe-signature header
  webhookSecret     // STRIPE_WEBHOOK_SECRET
);
```

### processWebhookEvent

Extracts relevant data from a Stripe webhook event.

```typescript
import { processWebhookEvent } from "stripe-convex/convex";

const eventData = processWebhookEvent(event);

if (eventData) {
  console.log(eventData.type); // "checkout.session.completed"
  console.log(eventData.data); // Normalized data for your handlers
}
```

---

## Function Handlers

### customers

Customer management handlers.

```typescript
import { customers } from "stripe-convex/convex";

// In your mutation
const customer = await customers.getOrCreate.handler(ctx, {
  email: "customer@example.com",
});

// Get by email
const existing = await customers.getByEmail.handler(ctx, {
  email: "customer@example.com",
});

// Update
await customers.update.handler(ctx, {
  email: "customer@example.com",
  stripeCustomerId: "cus_xxx",
  name: "John Doe",
});
```

### payments

Payment record handlers.

```typescript
import { payments } from "stripe-convex/convex";

// Create payment record
const paymentId = await payments.create.handler(ctx, {
  email: "customer@example.com",
  amount: 1999,
  currency: "usd",
  stripePaymentIntentId: "pi_xxx",
});

// Get by email
const userPayments = await payments.getByEmail.handler(ctx, {
  email: "customer@example.com",
});

// Update status
await payments.updateStatus.handler(ctx, {
  paymentId,
  status: "succeeded",
});
```

### subscriptions

Subscription record handlers.

```typescript
import { subscriptions } from "stripe-convex/convex";

// Create subscription record
const subId = await subscriptions.create.handler(ctx, {
  email: "customer@example.com",
  planId: "pro",
  stripeSubscriptionId: "sub_xxx",
  currentPeriodStart: Date.now(),
  currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
});

// Get active subscription
const activeSub = await subscriptions.getActive.handler(ctx, {
  email: "customer@example.com",
});

// Get by plan
const proUsers = await subscriptions.getByPlan.handler(ctx, {
  planId: "pro",
});

// Cancel
await subscriptions.cancel.handler(ctx, {
  subscriptionId: subId,
});
```

### orders

Order record handlers.

```typescript
import { orders } from "stripe-convex/convex";

// Create order
const orderId = await orders.create.handler(ctx, {
  email: "customer@example.com",
  items: [
    { id: "1", title: "Widget", price: 1999, quantity: 2 },
  ],
  subtotal: 3998,
  discount: 0,
  total: 3998,
  couponCode: undefined,
});

// Get by email
const userOrders = await orders.getByEmail.handler(ctx, {
  email: "customer@example.com",
});

// Update status
await orders.updateStatus.handler(ctx, {
  orderId,
  status: "completed",
});
```

### coupons

Coupon utilities and usage tracking.

```typescript
import { coupons, validateCoupon, calculateDiscount } from "stripe-convex/convex";

// Validate coupon (pure function, no DB)
const validation = validateCoupon(couponRule, {
  email: "customer@example.com",
  orderAmount: 5000,
  isSubscription: false,
  currentUsage: 5,
  emailUsage: 0,
});

if (!validation.valid) {
  console.error(validation.error);
}

// Calculate discount (pure function)
const discount = calculateDiscount(couponRule, 5000);

// Get usage count
const count = await coupons.getUsageCount.handler(ctx, {
  code: "SAVE20",
});

// Get email usage count
const emailCount = await coupons.getEmailUsageCount.handler(ctx, {
  code: "SAVE20",
  email: "customer@example.com",
});

// Record usage
await coupons.recordUsage.handler(ctx, {
  code: "SAVE20",
  email: "customer@example.com",
  orderId,
  discountAmount: 1000,
});
```

### access

Access control handlers.

```typescript
import { access } from "stripe-convex/convex";

// Check access to feature or plan
const hasAccess = await access.checkAccess.handler(ctx, {
  email: "customer@example.com",
  feature: "api-access",    // Optional
  plan: "pro",              // Optional
  plans: yourPlansArray,    // Your plan definitions
});

// Returns true if:
// - User has active subscription to specified plan, OR
// - User has active subscription to a plan with the specified feature, OR
// - User has a one-time payment with the feature in metadata
```

### webhooks

Webhook event handlers. See [Webhooks Documentation](./webhooks.md) for complete usage.

```typescript
import { webhooks } from "stripe-convex/convex";

// Check if already processed
const processed = await webhooks.hasProcessedEvent.handler(ctx, {
  stripeEventId: event.id,
});

// Record event
await webhooks.recordEvent.handler(ctx, {
  stripeEventId: event.id,
  type: event.type,
  data: event.data.object,
});

// Process checkout
await webhooks.processCheckoutCompleted.handler(ctx, {
  sessionId: "cs_xxx",
  customerEmail: "customer@example.com",
  paymentIntentId: "pi_xxx",
  amountTotal: 1999,
  currency: "usd",
});

// Mark processed
await webhooks.markProcessed.handler(ctx, {
  stripeEventId: event.id,
});
```

---

## Example: Full Checkout Action

```typescript
// convex/stripe.ts
import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { createCheckoutSession, orders, coupons } from "stripe-convex/convex";
import { config, plans } from "../lib/payment-config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const checkout = action({
  args: {
    email: v.string(),
    items: v.array(v.object({
      id: v.string(),
      title: v.string(),
      price: v.number(),
      quantity: v.number(),
      planId: v.optional(v.string()),
      isSubscription: v.optional(v.boolean()),
    })),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Create order record
    const subtotal = args.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = subtotal - (args.discountAmount || 0);
    
    const orderId = await ctx.runMutation(internal.stripe.createOrder, {
      email: args.email,
      items: args.items,
      subtotal,
      discount: args.discountAmount || 0,
      total,
      couponCode: args.couponCode,
    });

    // Create Stripe session
    const session = await createCheckoutSession(stripe, {
      email: args.email,
      items: args.items,
      successUrl: `${config.successUrl}?order=${orderId}`,
      cancelUrl: config.cancelUrl!,
      isSubscription: args.items.some(i => i.isSubscription),
      metadata: { orderId },
    });

    return { url: session.url, orderId };
  },
});

export const createOrder = internalMutation({
  args: {
    email: v.string(),
    items: v.any(),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await orders.create.handler(ctx, args);
  },
});
```

---

## TypeScript Types

All handlers are fully typed. Import types from the main package:

```typescript
import type {
  Plan,
  PlanFeature,
  CouponRule,
  AppliedCoupon,
  Cart,
  CartItem,
  Payment,
  Subscription,
  Order,
  Customer,
  PaymentStatus,
  SubscriptionStatus,
} from "stripe-convex";
```
