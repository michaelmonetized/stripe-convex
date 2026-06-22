# FALLOW REVIEW

## HEALTH

## Vital Signs

| Metric | Value |
|:-------|------:|
| Total LOC | 5762 |
| Avg Cyclomatic | 2.4 |
| P90 Cyclomatic | 5 |
| Dead Files | 23.1% |
| Dead Exports | 0.4% |
| Maintainability (avg) | 87.3 |
| Circular Deps | 0 |
| Unused Deps | 0 |

## Fallow: 22 high complexity functions

| File | Function | Severity | Cyclomatic | Cognitive | CRAP | Lines |
|:-----|:---------|:---------|:-----------|:----------|:-----|:------|
| `src/convex/stripe.ts:512` | `processWebhookEvent` | critical | 45 **!** | 16 **!** | 2070.0 **!** | 200 |
| `src/convex/coupons.ts:41` | `validateCoupon` | critical | 19 | 21 **!** | 380.0 **!** | 74 |
| `src/convex/stripe.ts:350` | `syncCustomerData` | critical | 15 | 8 | 240.0 **!** | 43 |
| `src/convex/webhooks.ts:179` | `handler` | critical | 13 | 11 | 182.0 **!** | 100 |
| `src/convex/access.ts:44` | `handler` | critical | 12 | 17 **!** | 156.0 **!** | 82 |
| `example/convex-http.ts:42` | `handler` | critical | 11 | 7 | 132.0 **!** | 112 |
| `src/components/Pay.tsx:25` | `handleClick` | critical | 10 | 9 | 110.0 **!** | 34 |
| `example/pricing-page.tsx:64` | `<arrow>` | critical | 10 | 13 | 110.0 **!** | 60 |
| `src/components/Cart.tsx:10` | `Cart` | high | 9 | 9 | 90.0 **!** | 136 |
| `src/convex/access.ts:215` | `handler` | high | 9 | 14 | 90.0 **!** | 47 |
| `src/components/Checkout.tsx:28` | `handleCheckout` | high | 8 | 7 | 72.0 **!** | 33 |
| `src/convex/subscriptions.ts:99` | `handler` | high | 8 | 7 | 72.0 **!** | 35 |
| `src/components/Checkout.tsx:10` | `Checkout` | moderate | 6 | 5 | 42.0 **!** | 88 |
| `src/components/AddToCart.tsx:80` | `handleCheckout` | moderate | 6 | 4 | 42.0 **!** | 22 |
| `example/shop-page.tsx:163` | `CouponInput` | moderate | 6 | 5 | 42.0 **!** | 56 |
| `src/components/context.tsx:136` | `applyCoupon` | moderate | 6 | 4 | 42.0 **!** | 47 |
| `src/convex/stripe.ts:100` | `createCheckoutSession` | moderate | 5 | 5 | 30.0 **!** | 58 |
| `example/pricing-page.tsx:34` | `handleSubscribe` | moderate | 5 | 3 | 30.0 **!** | 20 |
| `example/convex-stripe.ts:53` | `handler` | moderate | 5 | 3 | 30.0 **!** | 23 |
| `src/components/Has.tsx:19` | `checkAccess` | moderate | 5 | 5 | 30.0 **!** | 17 |
| `src/components/Has.tsx:72` | `check` | moderate | 5 | 5 | 30.0 **!** | 21 |
| `src/convex/customers.ts:155` | `handler` | moderate | 5 | 4 | 30.0 **!** | 22 |

**26** files, **215** functions analyzed (thresholds: cyclomatic > 20, cognitive > 15, CRAP >= 30.0)



## AUDIT


Audit scope: 12 changed files vs main (cb6aabf..HEAD)
## Vital Signs

| Metric | Value |
|:-------|------:|
| Total LOC | 895 |
| Avg Cyclomatic | 2.2 |
| P90 Cyclomatic | 4 |
| Dead Files | 0.0% |
| Dead Exports | 0.0% |
| Maintainability (avg) | 91.4 |
| Circular Deps | 0 |
| Unused Deps | 0 |

## Fallow: 1 high complexity function

| File | Function | Severity | Cyclomatic | Cognitive | CRAP | Lines |
|:-----|:---------|:---------|:-----------|:----------|:-----|:------|
| `src/components/AddToCart.tsx:80` | `handleCheckout` | moderate | 6 | 4 | 42.0 **!** | 22 |

**4** files, **14** functions analyzed (thresholds: cyclomatic > 20, cognitive > 15, CRAP >= 30.0)

✗ complexity: 1 finding · 12 changed files (0.21s)


## DEAD

## Fallow: 24 issues found

### Unused files (6)

- `example/convex-http.ts`
- `example/convex-stripe.ts`
- `example/payment-config.ts`
- `example/pricing-page.tsx`
- `example/providers.tsx`
- `example/shop-page.tsx`

### Unused exports (1)

- `src/convex/schema.ts`
  - :256 `default`

### Unresolved imports (13)

- `example/convex-http.ts`
  - :9 `./_generated/server`
- `example/convex-stripe.ts`
  - :8 `./_generated/server`
  - :8 `./_generated/server`
  - :8 `./_generated/server`
  - :8 `./_generated/server`
  - :22 `../lib/payment-config`
  - :22 `../lib/payment-config`
  - :22 `../lib/payment-config`
- `example/pricing-page.tsx`
  - :14 `../convex/_generated/api`
  - :16 `../lib/payment-config`
  - :16 `../lib/payment-config`
- `example/providers.tsx`
  - :12 `../convex/_generated/api`
  - :14 `../lib/payment-config`

### Duplicate exports (4)

- `create` in `src/convex/orders.ts`, `src/convex/payments.ts`, `src/convex/subscriptions.ts`
- `getByEmail` in `src/convex/customers.ts`, `src/convex/orders.ts`, `src/convex/payments.ts`, `src/convex/subscriptions.ts`
- `getByStripeId` in `src/convex/customers.ts`, `src/convex/subscriptions.ts`
- `updateStatus` in `src/convex/orders.ts`, `src/convex/payments.ts`




## DUPLICATION

note: hid 10 clone groups below minOccurrences=3 (lower --min-occurrences to see them)
## Fallow: 3 clone groups found (4.6% duplication)

### Duplicates

**Clone group 1** (8 lines, 3 instances)

- `src/convex/access.ts:47-54`
- `src/convex/access.ts:155-162`
- `src/convex/subscriptions.ts:166-172`

**Clone group 2** (11 lines, 4 instances)

- `src/convex/access.ts:48-58`
- `src/convex/access.ts:157-166`
- `src/convex/access.ts:219-229`
- `src/convex/subscriptions.ts:245-251`

**Clone group 3** (12 lines, 3 instances)

- `src/convex/stripe.ts:601-612`
- `src/convex/stripe.ts:621-631`
- `src/convex/stripe.ts:638-648`

### Clone Families

**Family 1** (2 groups, 19 lines across `src/convex/access.ts`, `src/convex/subscriptions.ts`)

- Extract shared function (11 lines) from access.ts, access.ts, access.ts, subscriptions.ts (~33 lines saved)
- Extract shared function (8 lines) from access.ts, access.ts, subscriptions.ts (~16 lines saved)

**Family 2** (1 group, 12 lines across `src/convex/stripe.ts`)

- Extract shared function (12 lines) from stripe.ts, stripe.ts, stripe.ts (~24 lines saved)

**Summary:** 260 duplicated lines (4.6%) across 5 files



## DOCSTRINGS

### Docstring Coverage

- Status: fail
- Coverage: 80.95%
- Documented symbols: 119/147
- Missing docstrings: 28

