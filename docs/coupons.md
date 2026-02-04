# Coupon System

stripe-convex provides a TypeScript-first coupon system with full type safety and flexible validation rules.

## Overview

Define coupons in code with:
- Percentage or fixed discounts
- Expiration dates
- Usage limits (global and per-email)
- Minimum order requirements
- Plan/subscription restrictions

## Defining Coupons

```typescript
// lib/payment-config.ts
import type { CouponRule } from "stripe-convex";

export const coupons: CouponRule[] = [
  // Simple percentage discount
  {
    code: "WELCOME20",
    discountType: "percentage",
    discountValue: 20,
    description: "20% off your first purchase",
    maxUsesPerEmail: 1,
  },

  // Fixed amount discount
  {
    code: "FLAT10",
    discountType: "fixed",
    discountValue: 1000, // $10 in cents
    description: "$10 off any order",
  },
];
```

## CouponRule Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Unique coupon code (case-insensitive) |
| `discountType` | `"percentage" \| "fixed"` | Yes | Type of discount |
| `discountValue` | `number` | Yes | Discount amount (percent 0-100 or cents) |
| `description` | `string` | No | Human-readable description |
| `active` | `boolean` | No | Whether coupon is active (default: true) |
| `expiresAt` | `string \| number` | No | Expiration (ISO date or timestamp) |
| `maxUses` | `number` | No | Maximum global uses |
| `maxUsesPerEmail` | `number` | No | Maximum uses per email |
| `minOrderAmount` | `number` | No | Minimum order in cents |
| `applicablePlans` | `string[]` | No | Only valid for these plan IDs |
| `subscriptionOnly` | `boolean` | No | Only valid for subscriptions |
| `oneTimeOnly` | `boolean` | No | Only valid for one-time purchases |

## Coupon Examples

### Percentage Discounts

```typescript
// Simple percentage
{
  code: "HALF50",
  discountType: "percentage",
  discountValue: 50,
  description: "50% off",
}

// First-time customer only
{
  code: "WELCOME20",
  discountType: "percentage",
  discountValue: 20,
  description: "20% off your first purchase",
  maxUsesPerEmail: 1,
}

// Capped percentage (handled in your UI)
{
  code: "MAX50OFF",
  discountType: "percentage",
  discountValue: 25,
  description: "25% off (max $50)",
  // Note: cap logic in your checkout
}
```

### Fixed Amount Discounts

```typescript
// Simple fixed amount
{
  code: "FLAT10",
  discountType: "fixed",
  discountValue: 1000, // $10
}

// Minimum order required
{
  code: "SPEND50SAVE15",
  discountType: "fixed",
  discountValue: 1500, // $15 off
  minOrderAmount: 5000, // On orders $50+
  description: "$15 off orders over $50",
}
```

### Time-Limited Coupons

```typescript
// Expires on a specific date
{
  code: "HOLIDAY25",
  discountType: "percentage",
  discountValue: 25,
  expiresAt: "2025-12-31T23:59:59Z",
  description: "Holiday sale - 25% off",
}

// Expires in 30 days from creation
{
  code: "FLASH30",
  discountType: "percentage",
  discountValue: 30,
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  description: "Flash sale - 30% off",
}
```

### Usage Limits

```typescript
// Limited total uses
{
  code: "FIRST100",
  discountType: "percentage",
  discountValue: 40,
  maxUses: 100, // First 100 customers
  description: "40% off - first 100 customers",
}

// One per customer
{
  code: "ONCEPERCUSTOMER",
  discountType: "fixed",
  discountValue: 500,
  maxUsesPerEmail: 1,
}

// Both limits
{
  code: "LIMITED",
  discountType: "percentage",
  discountValue: 30,
  maxUses: 500,       // 500 total
  maxUsesPerEmail: 2, // 2 per customer
}
```

### Plan Restrictions

```typescript
// Only for specific plans
{
  code: "PROONLY",
  discountType: "percentage",
  discountValue: 20,
  applicablePlans: ["pro", "enterprise"],
  description: "20% off Pro and Enterprise",
}

// Subscriptions only
{
  code: "SUBONLY",
  discountType: "percentage",
  discountValue: 15,
  subscriptionOnly: true,
  description: "15% off your first month",
}

// One-time purchases only
{
  code: "ONETIMEONLY",
  discountType: "fixed",
  discountValue: 2000,
  oneTimeOnly: true,
  description: "$20 off one-time purchases",
}
```

## Validation Functions

### validateCoupon

Validates a coupon against order parameters.

```typescript
import { validateCoupon } from "stripe-convex/convex";

const result = validateCoupon(couponRule, {
  email: "customer@example.com",
  orderAmount: 5000, // $50 in cents
  isSubscription: false,
  planId: "pro",          // Optional
  currentUsage: 5,        // Global usage count
  emailUsage: 0,          // This email's usage count
});

if (!result.valid) {
  console.error(result.error);
  // "Coupon has expired"
  // "Coupon usage limit reached"
  // "You have already used this coupon"
  // "Minimum order amount is $50.00"
  // "Coupon only valid for subscriptions"
  // "Coupon not valid for this plan"
}
```

### calculateDiscount

Calculates the discount amount for an order.

```typescript
import { calculateDiscount } from "stripe-convex/convex";

// Percentage: 20% of $50 = $10
const discount1 = calculateDiscount(
  { code: "SAVE20", discountType: "percentage", discountValue: 20 },
  5000 // $50
); // Returns 1000 ($10)

// Fixed: $15 off $50 = $15
const discount2 = calculateDiscount(
  { code: "FLAT15", discountType: "fixed", discountValue: 1500 },
  5000
); // Returns 1500 ($15)

// Fixed capped at order amount
const discount3 = calculateDiscount(
  { code: "FLAT15", discountType: "fixed", discountValue: 1500 },
  1000 // $10 order
); // Returns 1000 ($10, capped)
```

### applyCouponToOrder

Combines validation and calculation in one call.

```typescript
import { applyCouponToOrder } from "stripe-convex/convex";

const result = applyCouponToOrder(couponRule, {
  email: "customer@example.com",
  orderAmount: 5000,
  isSubscription: false,
  currentUsage: 0,
  emailUsage: 0,
});

if ("error" in result) {
  console.error(result.error);
} else {
  console.log(result.code);           // "SAVE20"
  console.log(result.discountType);   // "percentage"
  console.log(result.discountValue);  // 20
  console.log(result.discountAmount); // 1000 (calculated)
}
```

## Usage Tracking

Track coupon usage in your database to enforce limits.

### Recording Usage

```typescript
import { coupons } from "stripe-convex/convex";

// After successful order
await coupons.recordUsage.handler(ctx, {
  code: "SAVE20",
  email: "customer@example.com",
  orderId: orderId,
  discountAmount: 1000,
});
```

### Checking Usage

```typescript
import { coupons } from "stripe-convex/convex";

// Get global usage
const totalUsage = await coupons.getUsageCount.handler(ctx, {
  code: "SAVE20",
});

// Get per-email usage
const emailUsage = await coupons.getEmailUsageCount.handler(ctx, {
  code: "SAVE20",
  email: "customer@example.com",
});

// Use in validation
const validation = validateCoupon(couponRule, {
  email,
  orderAmount,
  isSubscription,
  currentUsage: totalUsage,
  emailUsage: emailUsage,
});
```

## React Integration

### Using useCoupon Hook

```typescript
import { useCoupon } from "stripe-convex";

function CouponInput() {
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleApply = async () => {
    const result = await applyCoupon(code);
    if (result) {
      setCode("");
      setError("");
    } else {
      setError("Invalid or expired coupon");
    }
  };

  return (
    <div>
      {appliedCoupon ? (
        <div>
          <span>{appliedCoupon.code}: -{formatCents(appliedCoupon.discountAmount)}</span>
          <button onClick={removeCoupon}>Remove</button>
        </div>
      ) : (
        <div>
          <input value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={handleApply}>Apply</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

### Provider Setup with Usage Tracking

```typescript
<StripeConvexProvider
  config={config}
  onGetCouponUsage={async (code, email) => {
    // Fetch from your Convex backend
    const usage = await getCouponUsage({ code, email });
    return {
      total: usage.totalCount,
      email: usage.emailCount,
    };
  }}
>
  {children}
</StripeConvexProvider>
```

## Stripe Sync

To sync coupons with Stripe Promotion Codes:

```typescript
// Create coupon in Stripe
const stripeCoupon = await stripe.coupons.create({
  id: "WELCOME20",
  percent_off: 20,
  duration: "once",
});

// Create promotion code
const promoCode = await stripe.promotionCodes.create({
  coupon: stripeCoupon.id,
  code: "WELCOME20",
  max_redemptions: 1000,
});
```

For most use cases, the TypeScript-based coupons are sufficient and more flexible. Use Stripe coupons when you need:
- Recurring subscription discounts
- Complex duration rules (repeating for N months)
- Stripe-level reporting on promotions
