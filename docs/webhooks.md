# Stripe Webhook Handling

stripe-convex provides idempotent webhook handling for Stripe events.

## Overview

Webhooks are essential for:
- Confirming successful payments
- Updating subscription status
- Processing refunds
- Handling failed payments

## Setup

### 1. Create HTTP Endpoint

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import Stripe from "stripe";
import { 
  verifyWebhookSignature, 
  processWebhookEvent, 
  webhooks 
} from "stripe-convex/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    try {
      // 1. Verify signature
      const event = verifyWebhookSignature(
        stripe, 
        body, 
        signature, 
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      // 2. Check idempotency (prevent duplicate processing)
      const processed = await ctx.runMutation(webhooks.hasProcessedEvent, {
        stripeEventId: event.id,
      });
      
      if (processed) {
        return new Response("Already processed", { status: 200 });
      }

      // 3. Record event
      await ctx.runMutation(webhooks.recordEvent, {
        stripeEventId: event.id,
        type: event.type,
        data: event.data.object,
      });

      // 4. Process event
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

      // 5. Mark as processed
      await ctx.runMutation(webhooks.markProcessed, { 
        stripeEventId: event.id 
      });

      return new Response("OK", { status: 200 });
      
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Webhook error", { status: 400 });
    }
  }),
});

export default http;
```

### 2. Configure Stripe Dashboard

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your endpoint URL: `https://your-app.convex.site/stripe-webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the webhook signing secret to your environment variables

### 3. Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Webhook Handlers

### processCheckoutCompleted

Handles successful checkout sessions. Creates payment/subscription records.

```typescript
await webhooks.processCheckoutCompleted.handler(ctx, {
  sessionId: "cs_xxx",
  customerEmail: "customer@example.com",
  paymentIntentId: "pi_xxx",        // For one-time payments
  subscriptionId: "sub_xxx",         // For subscriptions
  amountTotal: 1999,
  currency: "usd",
  metadata: { orderId: "123" },
});
```

**What it does:**
1. Creates or retrieves customer record
2. For one-time payments: creates/updates payment record
3. For subscriptions: creates/updates subscription record
4. Returns `{ type: "payment" | "subscription", id: string }`

### processSubscriptionUpdate

Handles subscription changes (status, billing period, cancellation).

```typescript
await webhooks.processSubscriptionUpdate.handler(ctx, {
  stripeSubscriptionId: "sub_xxx",
  status: "active",
  currentPeriodStart: 1704067200000,
  currentPeriodEnd: 1706745600000,
  cancelAtPeriodEnd: false,
});
```

**Status mapping:**
| Stripe Status | stripe-convex Status |
|---------------|---------------------|
| `active` | `active` |
| `past_due` | `past_due` |
| `canceled` | `cancelled` |
| `unpaid` | `unpaid` |
| `trialing` | `trialing` |
| `paused` | `paused` |

### processSubscriptionDeleted

Handles subscription cancellation.

```typescript
await webhooks.processSubscriptionDeleted.handler(ctx, {
  stripeSubscriptionId: "sub_xxx",
});
```

**What it does:**
- Sets subscription status to `cancelled`
- Records `cancelledAt` timestamp

### processRefund

Handles payment refunds.

```typescript
await webhooks.processRefund.handler(ctx, {
  chargeId: "ch_xxx",
  paymentIntentId: "pi_xxx",
});
```

**What it does:**
- Finds payment by PaymentIntent ID or Charge ID
- Sets payment status to `refunded`

## Event Recording

### hasProcessedEvent

Check if an event was already processed (idempotency).

```typescript
const processed = await webhooks.hasProcessedEvent.handler(ctx, {
  stripeEventId: "evt_xxx",
});

if (processed) {
  // Skip processing
  return new Response("OK", { status: 200 });
}
```

### recordEvent

Record event for audit log and debugging.

```typescript
await webhooks.recordEvent.handler(ctx, {
  stripeEventId: "evt_xxx",
  type: "checkout.session.completed",
  data: event.data.object,
});
```

### markProcessed

Mark event as successfully processed.

```typescript
await webhooks.markProcessed.handler(ctx, {
  stripeEventId: "evt_xxx",
});

// With error
await webhooks.markProcessed.handler(ctx, {
  stripeEventId: "evt_xxx",
  error: "Processing failed: inventory unavailable",
});
```

## Custom Event Handling

Handle additional events or add custom logic:

```typescript
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // ... verification and idempotency check ...

    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        
        // Built-in processing
        await ctx.runMutation(webhooks.processCheckoutCompleted, {
          sessionId: session.id,
          customerEmail: session.customer_email,
          // ...
        });
        
        // Custom: send welcome email
        if (session.metadata?.planId === "pro") {
          await ctx.runAction(internal.email.sendWelcome, {
            email: session.customer_email,
            plan: "pro",
          });
        }
        break;

      case "invoice.payment_failed":
        // Custom handling for failed payments
        const invoice = event.data.object;
        await ctx.runAction(internal.email.sendPaymentFailed, {
          email: invoice.customer_email,
          amount: invoice.amount_due,
        });
        break;

      case "customer.subscription.trial_will_end":
        // Custom: warn about trial ending
        const subscription = event.data.object;
        await ctx.runAction(internal.email.sendTrialEnding, {
          email: subscription.customer_email,
          endsAt: subscription.trial_end,
        });
        break;

      // ... other events
    }

    // ... mark processed ...
  }),
});
```

## Testing Webhooks

### Local Development

Use Stripe CLI to forward webhooks locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to your local Convex
stripe listen --forward-to localhost:3000/stripe-webhook

# Or for Convex dev
stripe listen --forward-to https://your-dev.convex.site/stripe-webhook
```

### Trigger Test Events

```bash
# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger charge.refunded
```

### Webhook Event Log

Query the webhook events table for debugging:

```typescript
// convex/admin.ts
export const getRecentWebhookEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sc_webhook_events")
      .order("desc")
      .take(args.limit || 50);
  },
});
```

## Error Handling

### Retry Logic

Stripe automatically retries failed webhooks. Handle transient errors gracefully:

```typescript
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // ... process event ...
      return new Response("OK", { status: 200 });
      
    } catch (error) {
      // Log error but don't expose details
      console.error("Webhook error:", error);
      
      // Record failure for debugging
      if (event?.id) {
        await ctx.runMutation(webhooks.markProcessed, {
          stripeEventId: event.id,
          error: error.message,
        });
      }
      
      // 400 = don't retry, 500 = retry
      const isTransient = error.message.includes("timeout");
      return new Response("Error", { 
        status: isTransient ? 500 : 400 
      });
    }
  }),
});
```

### Signature Verification Failures

Common causes:
- Wrong webhook secret
- Request body was modified/parsed before verification
- Clock skew

```typescript
try {
  const event = verifyWebhookSignature(stripe, body, signature, secret);
} catch (error) {
  if (error.type === "StripeSignatureVerificationError") {
    console.error("Invalid signature - check STRIPE_WEBHOOK_SECRET");
    return new Response("Invalid signature", { status: 400 });
  }
  throw error;
}
```

## Supported Events (19 Total)

All events follow [Theo's Stripe recommendations](https://github.com/t3dotgg/stripe-recommendations).

### Checkout Events
| Event | Handler | Description |
|-------|---------|-------------|
| `checkout.session.completed` | `processCheckoutCompleted` | Payment/subscription created |

### Subscription Lifecycle Events
| Event | Handler | Description |
|-------|---------|-------------|
| `customer.subscription.created` | `processSubscriptionUpdate` | New subscription |
| `customer.subscription.updated` | `processSubscriptionUpdate` | Status/period change |
| `customer.subscription.deleted` | `processSubscriptionDeleted` | Subscription cancelled |
| `customer.subscription.paused` | Custom | Subscription paused |
| `customer.subscription.resumed` | Custom | Subscription resumed |
| `customer.subscription.pending_update_applied` | Custom | Pending update applied |
| `customer.subscription.pending_update_expired` | Custom | Pending update expired |
| `customer.subscription.trial_will_end` | Custom | Trial ending soon (3 days before) |

### Invoice Events
| Event | Handler | Description |
|-------|---------|-------------|
| `invoice.paid` | Custom | Invoice paid successfully |
| `invoice.payment_succeeded` | Custom | Invoice payment succeeded |
| `invoice.payment_failed` | Custom | Invoice payment failed |
| `invoice.payment_action_required` | Custom | Payment requires action (3DS, etc.) |
| `invoice.upcoming` | Custom | Upcoming invoice (for notifications) |
| `invoice.marked_uncollectible` | Custom | Invoice marked uncollectible |

### Payment Intent Events
| Event | Handler | Description |
|-------|---------|-------------|
| `payment_intent.succeeded` | Custom | One-time payment successful |
| `payment_intent.payment_failed` | Custom | One-time payment failed |
| `payment_intent.canceled` | Custom | Payment cancelled |

### Refund Events
| Event | Handler | Description |
|-------|---------|-------------|
| `charge.refunded` | `processRefund` | Refund processed |
