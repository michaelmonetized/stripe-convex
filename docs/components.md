# React Components

stripe-convex provides drop-in React components for common payment flows.

## StripeConvexProvider

The context provider that wraps your app and manages cart/checkout state.

```tsx
import { StripeConvexProvider } from "stripe-convex";

<StripeConvexProvider
  config={config}
  onCheckout={async (cart) => {
    // Call your Convex checkout action
    return { url: checkoutUrl };
  }}
  onCheckAccess={async ({ feature, plan, email }) => {
    // Call your Convex access check query
    return hasAccess;
  }}
  onGetCouponUsage={async (code, email) => {
    // Get coupon usage counts from Convex
    return { total: 5, email: 0 };
  }}
>
  {children}
</StripeConvexProvider>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `StripeConvexConfig` | Yes | Plans, coupons, and settings |
| `onCheckout` | `(cart: Cart) => Promise<{ url: string } \| null>` | No | Checkout handler |
| `onCheckAccess` | `(params) => Promise<boolean>` | No | Access check handler |
| `onGetCouponUsage` | `(code, email) => Promise<{ total, email }>` | No | Coupon usage handler |

---

## Pay

Quick payment button for one-time or subscription payments.

```tsx
import { Pay } from "stripe-convex";

// One-time payment
<Pay amount={1999}>Buy Now - $19.99</Pay>

// Subscription
<Pay amount={999} subscription planId="pro">
  Subscribe - $9.99/month
</Pay>

// With callbacks
<Pay 
  amount={2999}
  onSuccess={(payment) => console.log("Paid!", payment)}
  onError={(error) => console.error(error)}
  className="btn-primary"
>
  Purchase
</Pay>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `amount` | `number` | Yes | Amount in cents |
| `subscription` | `boolean` | No | Whether this is a subscription |
| `planId` | `string` | No | Plan ID for subscriptions |
| `children` | `ReactNode` | Yes | Button content |
| `onSuccess` | `(payment: Payment) => void` | No | Success callback |
| `onError` | `(error: Error) => void` | No | Error callback |
| `className` | `string` | No | CSS class name |

### Behavior

1. If no email is set, prompts user for email
2. Clears cart and adds the payment item
3. Initiates checkout and redirects to Stripe

---

## AddToCart (Compound Component)

A compound component pattern for building add-to-cart UI. Supports both one-time purchases and subscriptions.

```tsx
import {
  AddToCart,
  CartItemTitle,
  CartItemPrice,
  CartItemDescription,
  CartItemButton,
  CartItemPlan,
} from "stripe-convex";

// One-time purchase
<AddToCart className="product-card">
  <CartItemTitle className="font-bold">Premium Widget</CartItemTitle>
  <CartItemPrice price={2999} className="text-green-600" />
  <CartItemDescription className="text-gray-600">
    A fantastic widget for all your needs
  </CartItemDescription>
  <CartItemButton className="btn-add">Add to Cart</CartItemButton>
</AddToCart>

// Subscription plan
<AddToCart isSubscription planId="pro" className="plan-card">
  <CartItemTitle className="font-bold">Pro Plan</CartItemTitle>
  <CartItemPrice price={999} className="text-green-600" />
  <CartItemPlan interval="month" className="text-gray-500" />
  <CartItemDescription className="text-gray-600">
    Unlimited access to all features
  </CartItemDescription>
  <CartItemButton className="btn-subscribe">Start with Pro Plan</CartItemButton>
</AddToCart>
```

### AddToCart Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Compound components |
| `className` | `string` | No | CSS class name |
| `isSubscription` | `boolean` | No | Whether this is a subscription item |
| `planId` | `string` | No | Plan ID for subscription items |

### CartItemTitle Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Item title text |
| `className` | `string` | No | CSS class name |

### CartItemPrice Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `price` | `number` | Yes | Price in cents |
| `className` | `string` | No | CSS class name |

### CartItemDescription Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Description text |
| `className` | `string` | No | CSS class name |

### CartItemButton Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Button text |
| `onClick` | `() => void` | No | Additional click handler |
| `className` | `string` | No | CSS class name |
| `addToCart` | `boolean` | No | Force add-to-cart behavior for subscriptions (default: false) |

**Note:** For subscriptions (`isSubscription={true}`), the button defaults to direct checkout behavior. Set `addToCart={true}` to add the subscription to the cart instead.

### CartItemPlan Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `interval` | `"month" \| "year" \| "week" \| "day"` | No | Billing interval |
| `children` | `ReactNode` | No | Custom content (overrides default interval text) |
| `className` | `string` | No | CSS class name |

**Display:** By default, renders the interval as `"/month"`, `"/year"`, etc. Pass custom children to override.

---

## Cart

Displays cart items with quantity controls and coupon input.

```tsx
import { Cart } from "stripe-convex";

<Cart 
  className="shopping-cart"
  emptyMessage={
    <div className="empty-state">
      <p>Your cart is empty</p>
      <a href="/shop">Continue shopping</a>
    </div>
  }
/>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `className` | `string` | No | CSS class name |
| `emptyMessage` | `ReactNode` | No | Content when cart is empty |

### Features

- Lists all cart items with title, description, price
- Quantity controls (+/- buttons)
- Remove item button
- Coupon code input with apply/remove
- Cart summary (subtotal, discount, total)

### CSS Classes

The component uses these CSS classes for styling:

- `.sc-cart-items` - Items container
- `.sc-cart-item` - Individual item
- `.sc-cart-item-info` - Item details
- `.sc-cart-item-title` - Item title
- `.sc-cart-item-description` - Item description
- `.sc-cart-item-price` - Item price
- `.sc-cart-item-controls` - Quantity controls
- `.sc-quantity-btn` - +/- buttons
- `.sc-quantity` - Quantity display
- `.sc-remove-btn` - Remove button
- `.sc-coupon-section` - Coupon area
- `.sc-coupon-input` - Coupon input container
- `.sc-coupon-field` - Coupon text input
- `.sc-apply-coupon` - Apply button
- `.sc-applied-coupon` - Applied coupon display
- `.sc-remove-coupon` - Remove coupon button
- `.sc-coupon-error` - Error message
- `.sc-cart-summary` - Summary section
- `.sc-summary-row` - Summary row
- `.sc-discount` - Discount row
- `.sc-total` - Total row

---

## Checkout

Email input and checkout button component.

```tsx
import { Checkout } from "stripe-convex";

// Default button text shows total
<Checkout className="checkout-form" />

// Custom button text
<Checkout className="checkout-form">
  Complete Purchase →
</Checkout>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `className` | `string` | No | CSS class name |
| `children` | `ReactNode` | No | Custom button text |

### Features

- Email input with validation
- Checkout button (disabled if cart empty)
- Loading state during checkout
- Error message display
- "Secure checkout" indicator

### CSS Classes

- `.sc-checkout-email` - Email section
- `.sc-email-label` - Email label
- `.sc-email-input` - Email input
- `.sc-checkout-error` - Error message
- `.sc-checkout-button` - Checkout button
- `.sc-checkout-secure` - Secure badge

---

## Has

Conditional rendering based on user access to features/plans.

```tsx
import { Has } from "stripe-convex";

// Check plan access
<Has plan="pro" user="user@example.com">
  <PremiumFeature />
</Has>

// Check feature access
<Has feature="api-access" user="user@example.com">
  <ApiDashboard />
</Has>

// With fallback
<Has 
  plan="pro" 
  user="user@example.com" 
  fallback={<UpgradePrompt />}
>
  <PremiumContent />
</Has>

// Check either feature or plan
<Has 
  feature="unlimited-projects"
  plan="enterprise"
  user="user@example.com"
>
  <UnlimitedProjectsUI />
</Has>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `feature` | `string` | No* | Feature ID to check |
| `plan` | `string` | No* | Plan ID to check |
| `user` | `string` | Yes | User email |
| `children` | `ReactNode` | Yes | Content if has access |
| `fallback` | `ReactNode` | No | Content if no access |

*At least one of `feature` or `plan` should be provided.

### Behavior

1. Renders nothing while loading
2. Shows `children` if user has access
3. Shows `fallback` (or nothing) if no access

---

## Component Styling

Components use minimal inline styles. Add your own styling via:

1. **className props** - Pass to any component
2. **CSS classes** - Target the `sc-*` classes
3. **CSS-in-JS** - Style the wrapper element

Example with Tailwind:

```tsx
<Cart className="bg-white rounded-lg shadow p-6" />
<Checkout className="mt-4 space-y-4" />
```

Example with CSS:

```css
.sc-cart-item {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.sc-checkout-button {
  background: #0070f3;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
}
```
