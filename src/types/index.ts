/**
 * @module stripe-convex/types
 * @description Type definitions for the stripe-convex package
 */

// ============================================
// COUPON SYSTEM TYPES
// ============================================

/**
 * Discount type for coupons
 * - `percentage`: Discount as a percentage (0-100)
 * - `fixed`: Fixed amount discount in cents
 */
export type CouponDiscountType = "percentage" | "fixed";

/**
 * Coupon rule definition for TypeScript-first coupon configuration.
 * Define coupons in code with full type safety and validation rules.
 * 
 * @example
 * ```ts
 * const coupon: CouponRule = {
 *   code: "WELCOME20",
 *   discountType: "percentage",
 *   discountValue: 20,
 *   description: "20% off your first purchase",
 *   maxUsesPerEmail: 1,
 * };
 * ```
 */
export interface CouponRule {
  /** Unique coupon code (case-insensitive matching) */
  code: string;
  /** Type of discount: "percentage" or "fixed" */
  discountType: CouponDiscountType;
  /** Discount value (percentage 0-100 or fixed amount in cents) */
  discountValue: number;
  /** Expiration date (ISO string or Unix timestamp in milliseconds) */
  expiresAt?: string | number;
  /** Maximum number of times this coupon can be used globally */
  maxUses?: number;
  /** Maximum uses per email address */
  maxUsesPerEmail?: number;
  /** Minimum order amount in cents required to use this coupon */
  minOrderAmount?: number;
  /** Only applies to specific plan IDs */
  applicablePlans?: string[];
  /** Only applies to subscription purchases */
  subscriptionOnly?: boolean;
  /** Only applies to one-time payments */
  oneTimeOnly?: boolean;
  /** Custom validation function name (for advanced rules) */
  customValidator?: string;
  /** Whether the coupon is currently active (default: true) */
  active?: boolean;
  /** Human-readable description for display */
  description?: string;
}

/**
 * Applied coupon result with calculated discount amount.
 * Returned when a coupon is successfully validated and applied to a cart.
 */
export interface AppliedCoupon {
  /** The coupon code that was applied */
  code: string;
  /** Type of discount */
  discountType: CouponDiscountType;
  /** Original discount value from the coupon rule */
  discountValue: number;
  /** Calculated discount amount in cents for the current order */
  discountAmount: number;
  /** Description for display */
  description?: string;
}

// ============================================
// PLAN & FEATURE TYPES
// ============================================

/**
 * Feature definition for a plan.
 * Features can have optional limits (e.g., "10,000 API calls").
 * 
 * @example
 * ```ts
 * const feature: PlanFeature = {
 *   id: "api-access",
 *   name: "API Access",
 *   description: "REST and GraphQL API access",
 *   limit: 10000, // 10,000 requests per month
 * };
 * ```
 */
export interface PlanFeature {
  /** Unique feature identifier */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Usage limit for this feature (-1 or undefined for unlimited) */
  limit?: number;
}

/**
 * Plan definition for pricing pages and access control.
 * Supports both one-time purchases and recurring subscriptions.
 * 
 * @example
 * ```ts
 * const plan: Plan = {
 *   id: "pro",
 *   name: "Pro Plan",
 *   description: "All features included",
 *   price: 1999, // $19.99
 *   interval: "month",
 *   isSubscription: true,
 *   features: [
 *     { id: "unlimited-projects", name: "Unlimited Projects" },
 *     { id: "priority-support", name: "Priority Support" },
 *   ],
 * };
 * ```
 */
export interface Plan {
  /** Unique plan identifier */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Price in cents for one-time or per billing period */
  price: number;
  /** Billing interval for subscriptions */
  interval?: "month" | "year" | "week" | "day";
  /** Features included in this plan */
  features: PlanFeature[];
  /** Whether this is a subscription plan (vs one-time purchase) */
  isSubscription: boolean;
  /** Stripe Price ID for sync with Stripe Products */
  stripePriceId?: string;
  /** Sort order for display on pricing pages */
  sortOrder?: number;
  /** Whether the plan is currently available */
  active?: boolean;
}

// ============================================
// CART TYPES
// ============================================

/**
 * Individual item in the shopping cart.
 */
export interface CartItem {
  /** Unique item ID (generated automatically) */
  id: string;
  /** Item title for display */
  title: string;
  /** Optional description */
  description?: string;
  /** Price in cents */
  price: number;
  /** Quantity of this item */
  quantity: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Plan ID if this is a subscription item */
  planId?: string;
  /** Whether this item is a subscription */
  isSubscription?: boolean;
}

/**
 * Shopping cart state with calculated totals.
 */
export interface Cart {
  /** Items in the cart */
  items: CartItem[];
  /** Subtotal before discounts (in cents) */
  subtotal: number;
  /** Total discount amount (in cents) */
  discount: number;
  /** Final total after discounts (in cents) */
  total: number;
  /** Currently applied coupon */
  appliedCoupon?: AppliedCoupon;
  /** Customer email for checkout */
  email?: string;
}

// ============================================
// PAYMENT & ORDER TYPES
// ============================================

/**
 * Payment status values.
 */
export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "cancelled";

/**
 * Subscription status values.
 */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "cancelled"
  | "unpaid"
  | "trialing"
  | "paused";

/**
 * Payment record stored in Convex.
 */
export interface Payment {
  /** Convex document ID */
  _id: string;
  /** Customer email */
  email: string;
  /** Amount in cents */
  amount: number;
  /** Currency code (e.g., "usd") */
  currency: string;
  /** Current payment status */
  status: PaymentStatus;
  /** Stripe PaymentIntent ID */
  stripePaymentIntentId?: string;
  /** Stripe Charge ID */
  stripeChargeId?: string;
  /** Applied coupon code */
  couponCode?: string;
  /** Discount amount in cents */
  discountAmount?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Subscription record stored in Convex.
 */
export interface Subscription {
  /** Convex document ID */
  _id: string;
  /** Customer email */
  email: string;
  /** Plan ID */
  planId: string;
  /** Current subscription status */
  status: SubscriptionStatus;
  /** Stripe Subscription ID */
  stripeSubscriptionId?: string;
  /** Stripe Customer ID */
  stripeCustomerId?: string;
  /** Current billing period start (timestamp) */
  currentPeriodStart: number;
  /** Current billing period end (timestamp) */
  currentPeriodEnd: number;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** Timestamp when subscription was cancelled */
  cancelledAt?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Order record stored in Convex.
 * Links cart items to payments/subscriptions.
 */
export interface Order {
  /** Convex document ID */
  _id: string;
  /** Customer email */
  email: string;
  /** Items in the order */
  items: CartItem[];
  /** Subtotal before discounts (in cents) */
  subtotal: number;
  /** Discount amount (in cents) */
  discount: number;
  /** Final total (in cents) */
  total: number;
  /** Applied coupon code */
  couponCode?: string;
  /** Associated payment ID */
  paymentId?: string;
  /** Associated subscription ID */
  subscriptionId?: string;
  /** Order status */
  status: "pending" | "completed" | "refunded" | "cancelled";
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

// ============================================
// CUSTOMER TYPES
// ============================================

/**
 * Customer record stored in Convex.
 */
export interface Customer {
  /** Convex document ID */
  _id: string;
  /** Customer email (primary identifier) */
  email: string;
  /** Stripe Customer ID */
  stripeCustomerId?: string;
  /** Customer name */
  name?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

// ============================================
// WEBHOOK TYPES
// ============================================

/**
 * Supported Stripe webhook event types.
 */
export type WebhookEventType =
  | "checkout.session.completed"
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "charge.refunded";

/**
 * Webhook event record for idempotency tracking.
 */
export interface WebhookEvent {
  /** Stripe event ID */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** Event data payload */
  data: Record<string, unknown>;
  /** Timestamp when event was processed */
  processedAt?: number;
  /** Error message if processing failed */
  error?: string;
}

// ============================================
// CONTEXT & PROVIDER TYPES
// ============================================

/**
 * Configuration options for the stripe-convex provider.
 * 
 * @example
 * ```ts
 * const config: StripeConvexConfig = {
 *   plans: [{ id: "pro", name: "Pro", price: 1999, isSubscription: true, features: [] }],
 *   coupons: [{ code: "SAVE20", discountType: "percentage", discountValue: 20 }],
 *   currency: "usd",
 *   successUrl: "https://example.com/success",
 *   cancelUrl: "https://example.com/cancel",
 * };
 * ```
 */
export interface StripeConvexConfig {
  /** Coupon rules defined in TypeScript */
  coupons?: CouponRule[];
  /** Plans defined in TypeScript */
  plans?: Plan[];
  /** Default currency (ISO code, e.g., "usd") */
  currency?: string;
  /** Redirect URL after successful payment */
  successUrl?: string;
  /** Redirect URL if payment is cancelled */
  cancelUrl?: string;
}

/**
 * Context value provided by StripeConvexProvider.
 * Access via useStripeConvex() hook.
 */
export interface StripeConvexContextValue {
  /** Current configuration */
  config: StripeConvexConfig;
  /** Current cart state */
  cart: Cart;
  /** Add an item to the cart */
  addToCart: (item: Omit<CartItem, "id" | "quantity">) => void;
  /** Remove an item from the cart */
  removeFromCart: (itemId: string) => void;
  /** Update item quantity */
  updateQuantity: (itemId: string, quantity: number) => void;
  /** Clear all items from cart */
  clearCart: () => void;
  /** Apply a coupon code */
  applyCoupon: (code: string) => Promise<AppliedCoupon | null>;
  /** Remove applied coupon */
  removeCoupon: () => void;
  /** Set customer email */
  setEmail: (email: string) => void;
  /** Initiate checkout and get Stripe URL */
  checkout: () => Promise<{ url: string } | null>;
  /** Check if an email has access to a feature/plan */
  hasAccess: (params: { feature?: string; plan?: string; email: string }) => Promise<boolean>;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

/**
 * Props for the Pay component.
 */
export interface PayProps {
  /** Amount in cents */
  amount: number;
  /** Whether this is a subscription payment */
  subscription?: boolean;
  /** Plan ID for subscriptions */
  planId?: string;
  /** Button content */
  children: React.ReactNode;
  /** Callback on successful payment */
  onSuccess?: (payment: Payment) => void;
  /** Callback on payment error */
  onError?: (error: Error) => void;
  /** CSS class name */
  className?: string;
}

/**
 * Props for the AddToCart compound component.
 */
export interface AddToCartProps {
  /** Child components (CartItemTitle, CartItemPrice, etc.) */
  children: React.ReactNode;
  /** CSS class name */
  className?: string;
}

/**
 * Props for CartItemTitle component.
 */
export interface CartItemTitleProps {
  /** Item title */
  children: React.ReactNode;
  /** CSS class name */
  className?: string;
}

/**
 * Props for CartItemPrice component.
 */
export interface CartItemPriceProps {
  /** Price in cents */
  price: number;
  /** CSS class name */
  className?: string;
}

/**
 * Props for CartItemDescription component.
 */
export interface CartItemDescriptionProps {
  /** Description text */
  children: React.ReactNode;
  /** CSS class name */
  className?: string;
}

/**
 * Props for CartItemButton component.
 */
export interface CartItemButtonProps {
  /** Button text */
  children: React.ReactNode;
  /** Additional click handler */
  onClick?: () => void;
  /** CSS class name */
  className?: string;
}

/**
 * Props for the Cart component.
 */
export interface CartProps {
  /** CSS class name */
  className?: string;
  /** Content to show when cart is empty */
  emptyMessage?: React.ReactNode;
}

/**
 * Props for the Checkout component.
 */
export interface CheckoutProps {
  /** CSS class name */
  className?: string;
  /** Custom button text */
  children?: React.ReactNode;
}

/**
 * Props for the Has component (conditional rendering).
 */
export interface HasProps {
  /** Feature ID to check access for */
  feature?: string;
  /** Plan ID to check access for */
  plan?: string;
  /** User email to check */
  user: string;
  /** Content to render if user has access */
  children: React.ReactNode;
  /** Content to render if user doesn't have access */
  fallback?: React.ReactNode;
}
