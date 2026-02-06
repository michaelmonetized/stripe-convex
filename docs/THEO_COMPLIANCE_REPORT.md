# Theo's Stripe Recommendations - Compliance Report

**Date:** 2026-02-06  
**Source:** https://github.com/t3dotgg/stripe-recommendations  
**Reviewed:** stripe-convex v1.0.0

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Webhook Handling | ✅ Good | Idempotent, event logging |
| Idempotency | ✅ Good | Event deduplication via `sc_webhook_events` |
| Error Handling | ⚠️ Adequate | Could add more retry logic |
| Customer Pre-creation | ❌ Missing | Uses `customer_email` instead |
| Success Page Sync | ❌ Missing | Not documented |
| syncStripeDataToKV Pattern | ⚠️ Partial | Has handlers but no single sync function |
| Metadata Usage | ⚠️ Partial | No userId on customer metadata |
| Payment Method Tracking | ❌ Missing | No brand/last4 storage |
| Customer Portal | ❌ Missing | No helpers |
| Event Coverage | ⚠️ Partial | Missing several Theo-recommended events |

---

## ✅ What stripe-convex Does Well

### 1. Idempotent Webhook Handling (webhooks.ts:1-51)
Excellent implementation with `sc_webhook_events` table:
- `hasProcessedEvent()` checks if event was already handled
- `recordEvent()` logs event before processing
- `markProcessed()` marks completion with optional error

**Theo's pattern:** ✅ Matches his advice on preventing duplicate processing

### 2. Webhook Signature Verification (stripe.ts:212-226)
Proper `verifyWebhookSignature()` function using `stripe.webhooks.constructEvent()`.

**Theo's pattern:** ✅ Correct implementation

### 3. Status Mapping (webhooks.ts:192-200)
Maps Stripe statuses to app-internal statuses:
```ts
const statusMap = {
  active: "active",
  past_due: "past_due",
  canceled: "cancelled",
  // ...
};
```

**Theo's pattern:** ✅ Good practice for avoiding Stripe-specific strings in app

### 4. Email-Based Tracking
While Theo uses `userId` → `stripeCustomerId` binding, stripe-convex's email-based approach is valid for many use cases (especially apps without auth).

**Trade-off:** Simpler, but less flexible for apps with user IDs

### 5. Schema Design (schema.ts)
Well-indexed tables with proper separation of concerns:
- `sc_customers` - Customer records
- `sc_subscriptions` - Subscription state
- `sc_payments` - Payment records
- `sc_webhook_events` - Event log

---

## ⚠️ What Could Be Improved

### 1. Missing Single Sync Function

**Theo's Pattern:**
```ts
// One function to rule them all
async function syncStripeDataToKV(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    expand: ["data.default_payment_method"],
  });
  // Store complete subscription state
  await kv.set(`stripe:customer:${customerId}`, subData);
}
```

**stripe-convex Current:** Has separate handlers (`processCheckoutCompleted`, `processSubscriptionUpdate`, etc.)

**Recommendation:** Add a `syncCustomerData(stripeCustomerId)` function that:
1. Fetches latest subscription from Stripe API
2. Updates local database with complete state
3. Is called from both webhooks AND success page

**File:** `src/convex/stripe.ts`

### 2. Missing Events (Theo tracks 19, we track ~7)

**Theo's Event List:**
```ts
const allowedEvents = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
];
```

**stripe-convex Current (stripe.ts:228-288):**
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ❌ `customer.subscription.paused`
- ❌ `customer.subscription.resumed`
- ❌ `customer.subscription.pending_update_*`
- ❌ `customer.subscription.trial_will_end`
- ❌ `invoice.*` events
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ❌ `payment_intent.canceled`
- ✅ `charge.refunded`

**File:** `src/convex/stripe.ts:processWebhookEvent()`

### 3. Missing Payment Method Data

**Theo stores:**
```ts
paymentMethod: {
  brand: subscription.default_payment_method.card?.brand,
  last4: subscription.default_payment_method.card?.last4,
}
```

**stripe-convex:** No payment method information in subscription schema.

**File:** `src/convex/schema.ts:sc_subscriptions` - Add `paymentMethodBrand` and `paymentMethodLast4`

### 4. No Metadata Binding Pattern

**Theo's Pattern:**
```ts
const newCustomer = await stripe.customers.create({
  email: user.email,
  metadata: {
    userId: user.id, // DO NOT FORGET THIS
  },
});
```

**stripe-convex Current:** Uses email only, no userId in metadata.

**For apps with auth:** Should support optional userId binding.

---

## ❌ What's Missing or Wrong

### 1. CRITICAL: Customer Not Pre-Created Before Checkout

**Theo (his #1 pain point):**
> "The key is to make sure you always have the customer defined BEFORE YOU START CHECKOUT. The ephemerality of 'customer' is a straight up design flaw."

**stripe-convex Current (stripe.ts:63-90):**
```ts
// Uses customer_email instead of customer ID!
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  mode: params.isSubscription ? "subscription" : "payment",
  customer_email: params.email,  // ❌ WRONG
  // Should be: customer: stripeCustomerId  // ✅ RIGHT
  ...
};
```

**Required Fix:**
```ts
export async function createCheckoutSession(stripe, params) {
  // 1. Get or create Stripe customer FIRST
  let customer = await getOrCreateStripeCustomer(stripe, params.email);
  
  // 2. Create checkout with customer ID
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,  // ✅ Always use customer ID
    // NOT customer_email
    ...
  });
}
```

**File:** `src/convex/stripe.ts:createCheckoutSession()` - Lines 57-92

### 2. Missing Success Page Sync Pattern

**Theo's Pattern:**
```ts
// /success endpoint - runs BEFORE webhooks arrive
export async function GET(req: Request) {
  const user = auth(req);
  const stripeCustomerId = await kv.get(`stripe:user:${user.id}`);
  await syncStripeDataToKV(stripeCustomerId);  // Eager sync!
  return redirect("/");
}
```

**stripe-convex:** No documentation or helpers for success page sync.

**Why it matters:** User often returns before webhook fires. Without eager sync, UI shows stale state.

**Required:** 
1. Add `syncAfterCheckout(email)` utility function
2. Document success page implementation pattern

### 3. Missing Customer Portal Helpers

**Theo recommends:** Using Stripe Customer Portal for subscription management.

**stripe-convex:** No `createPortalSession()` helper.

**Required:**
```ts
export async function createPortalSession(stripe, customerId, returnUrl) {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
```

### 4. No Guidance on "Limit to One Subscription"

**Theo:**
> "ENABLE 'Limit customers to one subscription'. This is a really useful hidden setting that has saved me a lot of headaches and race conditions."

**stripe-convex:** Not mentioned in docs.

**Required:** Add to docs/getting-started.md under Stripe Dashboard Setup.

---

## 📝 Specific Code Changes Recommended

### Priority 1: Fix Customer Pre-Creation (CRITICAL)

**File:** `src/convex/stripe.ts`

```diff
+ async function getOrCreateStripeCustomer(
+   stripe: Stripe,
+   email: string,
+   metadata?: Record<string, string>
+ ): Promise<Stripe.Customer> {
+   const existing = await stripe.customers.list({
+     email,
+     limit: 1,
+   });
+   
+   if (existing.data.length > 0) {
+     return existing.data[0];
+   }
+   
+   return await stripe.customers.create({
+     email,
+     metadata: {
+       ...metadata,
+       email,  // For easy lookup
+     },
+   });
+ }

export async function createCheckoutSession(
  stripe: Stripe,
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
+ // ALWAYS create customer first (Theo's #1 recommendation)
+ const customer = await getOrCreateStripeCustomer(stripe, params.email, params.metadata);
+
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: params.isSubscription ? "subscription" : "payment",
-   customer_email: params.email,
+   customer: customer.id,
    // ... rest unchanged
  };
```

### Priority 2: Add syncCustomerData Function

**File:** `src/convex/stripe.ts`

```ts
/**
 * Syncs all Stripe data for a customer to local database.
 * Call from success page AND webhooks for consistent state.
 * 
 * Based on Theo's syncStripeDataToKV pattern.
 */
export async function syncCustomerData(
  stripe: Stripe,
  customerId: string
): Promise<SubscriptionState> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: "all",
    expand: ["data.default_payment_method"],
  });

  if (subscriptions.data.length === 0) {
    return { status: "none" };
  }

  const sub = subscriptions.data[0];
  const paymentMethod = sub.default_payment_method;

  return {
    subscriptionId: sub.id,
    status: sub.status,
    priceId: sub.items.data[0]?.price.id,
    currentPeriodStart: sub.current_period_start * 1000,
    currentPeriodEnd: sub.current_period_end * 1000,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    paymentMethod: paymentMethod && typeof paymentMethod !== "string" ? {
      brand: paymentMethod.card?.brand ?? null,
      last4: paymentMethod.card?.last4 ?? null,
    } : null,
  };
}
```

### Priority 3: Add Missing Events

**File:** `src/convex/stripe.ts:processWebhookEvent()`

```diff
export function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    // ... existing cases ...

+   case "customer.subscription.paused":
+   case "customer.subscription.resumed":
+   case "customer.subscription.pending_update_applied":
+   case "customer.subscription.pending_update_expired": {
+     const subscription = event.data.object as Stripe.Subscription;
+     return {
+       type: event.type,
+       data: {
+         stripeSubscriptionId: subscription.id,
+         status: subscription.status,
+       },
+     };
+   }

+   case "customer.subscription.trial_will_end": {
+     const subscription = event.data.object as Stripe.Subscription;
+     return {
+       type: event.type,
+       data: {
+         stripeSubscriptionId: subscription.id,
+         trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : null,
+       },
+     };
+   }

+   case "invoice.paid":
+   case "invoice.payment_succeeded": {
+     const invoice = event.data.object as Stripe.Invoice;
+     return {
+       type: event.type,
+       data: {
+         invoiceId: invoice.id,
+         customerId: invoice.customer as string,
+         subscriptionId: invoice.subscription as string | undefined,
+         amountPaid: invoice.amount_paid,
+       },
+     };
+   }

+   case "invoice.payment_failed":
+   case "invoice.payment_action_required": {
+     const invoice = event.data.object as Stripe.Invoice;
+     return {
+       type: event.type,
+       data: {
+         invoiceId: invoice.id,
+         customerId: invoice.customer as string,
+         subscriptionId: invoice.subscription as string | undefined,
+         error: invoice.last_finalization_error?.message,
+       },
+     };
+   }

+   case "payment_intent.canceled": {
+     const paymentIntent = event.data.object as Stripe.PaymentIntent;
+     return {
+       type: event.type,
+       data: {
+         paymentIntentId: paymentIntent.id,
+         cancellationReason: paymentIntent.cancellation_reason,
+       },
+     };
+   }

    default:
      return null;
  }
}
```

### Priority 4: Add Customer Portal Helper

**File:** `src/convex/stripe.ts`

```ts
/**
 * Creates a Stripe Customer Portal session.
 * Use for subscription management (cancel, update payment, etc.)
 */
export async function createPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
```

### Priority 5: Update Schema for Payment Method

**File:** `src/convex/schema.ts`

```diff
sc_subscriptions: defineTable({
  email: v.string(),
  planId: v.string(),
  status: subscriptionStatusValidator,
  stripeSubscriptionId: v.optional(v.string()),
  stripeCustomerId: v.optional(v.string()),
+ stripePriceId: v.optional(v.string()),
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.optional(v.boolean()),
  cancelledAt: v.optional(v.number()),
+ paymentMethodBrand: v.optional(v.string()),
+ paymentMethodLast4: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

---

## Documentation Updates Needed

### 1. docs/getting-started.md

Add under "Stripe Dashboard Setup":
```markdown
### Recommended Settings

1. **Enable "Limit customers to one subscription"**
   - Go to Settings → Checkout → Customer options
   - Prevents race conditions from multiple checkout tabs
   - [Stripe docs](https://docs.stripe.com/payments/checkout/limit-subscriptions)

2. **Disable Cash App Pay** (if you see fraud)
   - Go to Settings → Payment methods
   - Over 90% of Theo's cancelled transactions were Cash App Pay
```

### 2. docs/webhooks.md

Add section on "Success Page Sync":
```markdown
## Success Page Pattern

Your success page should eagerly sync data before webhooks arrive:

\`\`\`tsx
// app/success/page.tsx
export default async function SuccessPage() {
  const email = await getSessionEmail(); // Your auth method
  
  // Eager sync - don't wait for webhooks!
  await convex.action(api.stripe.syncAfterCheckout, { email });
  
  redirect("/dashboard");
}
\`\`\`

This prevents the race condition where users see stale state.
```

---

## Conclusion

**Overall Grade: B-**

stripe-convex has solid foundations (idempotency, schema design, webhook verification) but deviates from Theo's core recommendations in critical areas:

1. **Customer pre-creation is missing** - This is Theo's #1 pain point
2. **No unified sync function** - Separate handlers vs. single sync pattern
3. **Success page sync not documented** - Common race condition source

The email-based tracking is a valid design choice for auth-less apps, but the library should still:
- Pre-create Stripe customers before checkout
- Provide a success page sync pattern
- Support optional userId binding for apps with auth

**Recommended priority:**
1. 🔴 Fix customer pre-creation (P0 - critical)
2. 🟡 Add syncCustomerData function (P1)
3. 🟡 Document success page pattern (P1)
4. 🟢 Add missing events (P2)
5. 🟢 Add customer portal helper (P2)
