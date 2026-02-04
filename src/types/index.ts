// ============================================
// COUPON SYSTEM TYPES
// ============================================

export type CouponDiscountType = "percentage" | "fixed";

export interface CouponRule {
  /** Unique coupon code */
  code: string;
  /** Type of discount */
  discountType: CouponDiscountType;
  /** Discount value (percentage 0-100 or fixed amount in cents) */
  discountValue: number;
  /** Expiration date (ISO string or timestamp) */
  expiresAt?: string | number;
  /** Maximum number of times this coupon can be used globally */
  maxUses?: number;
  /** Maximum uses per email */
  maxUsesPerEmail?: number;
  /** Minimum order amount in cents */
  minOrderAmount?: number;
  /** Only applies to specific plan IDs */
  applicablePlans?: string[];
  /** Only applies to subscriptions */
  subscriptionOnly?: boolean;
  /** Only applies to one-time payments */
  oneTimeOnly?: boolean;
  /** Custom validation function name (for advanced rules) */
  customValidator?: string;
  /** Whether the coupon is active */
  active?: boolean;
  /** Description for display */
  description?: string;
}

export interface AppliedCoupon {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountAmount: number; // Calculated discount in cents
  description?: string;
}

// ============================================
// PLAN & FEATURE TYPES
// ============================================

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  /** Limit for this feature (-1 for unlimited) */
  limit?: number;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  /** Price in cents for one-time or per billing period */
  price: number;
  /** Billing interval for subscriptions */
  interval?: "month" | "year" | "week" | "day";
  /** Features included in this plan */
  features: PlanFeature[];
  /** Is this a subscription plan? */
  isSubscription: boolean;
  /** Stripe Price ID (optional - for sync with Stripe) */
  stripePriceId?: string;
  /** Sort order for display */
  sortOrder?: number;
  /** Whether the plan is active */
  active?: boolean;
}

// ============================================
// CART TYPES
// ============================================

export interface CartItem {
  id: string;
  title: string;
  description?: string;
  price: number; // In cents
  quantity: number;
  metadata?: Record<string, unknown>;
  /** Plan ID if this is a subscription item */
  planId?: string;
  isSubscription?: boolean;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  appliedCoupon?: AppliedCoupon;
  email?: string;
}

// ============================================
// PAYMENT & ORDER TYPES
// ============================================

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "cancelled";

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "cancelled"
  | "unpaid"
  | "trialing"
  | "paused";

export interface Payment {
  _id: string;
  email: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  couponCode?: string;
  discountAmount?: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Subscription {
  _id: string;
  email: string;
  planId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  _id: string;
  email: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  paymentId?: string;
  subscriptionId?: string;
  status: "pending" | "completed" | "refunded" | "cancelled";
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// CUSTOMER TYPES
// ============================================

export interface Customer {
  _id: string;
  email: string;
  stripeCustomerId?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// WEBHOOK TYPES
// ============================================

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

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: Record<string, unknown>;
  processedAt?: number;
  error?: string;
}

// ============================================
// CONTEXT & PROVIDER TYPES
// ============================================

export interface StripeConvexConfig {
  /** Coupon rules defined in TypeScript */
  coupons?: CouponRule[];
  /** Plans defined in TypeScript */
  plans?: Plan[];
  /** Default currency (ISO code) */
  currency?: string;
  /** Success URL after payment */
  successUrl?: string;
  /** Cancel URL if payment cancelled */
  cancelUrl?: string;
}

export interface StripeConvexContextValue {
  config: StripeConvexConfig;
  cart: Cart;
  addToCart: (item: Omit<CartItem, "id" | "quantity">) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<AppliedCoupon | null>;
  removeCoupon: () => void;
  setEmail: (email: string) => void;
  checkout: () => Promise<{ url: string } | null>;
  /** Check if an email has access to a feature/plan */
  hasAccess: (params: { feature?: string; plan?: string; email: string }) => Promise<boolean>;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface PayProps {
  amount: number;
  subscription?: boolean;
  planId?: string;
  children: React.ReactNode;
  onSuccess?: (payment: Payment) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface AddToCartProps {
  children: React.ReactNode;
  className?: string;
}

export interface CartItemTitleProps {
  children: React.ReactNode;
  className?: string;
}

export interface CartItemPriceProps {
  price: number;
  className?: string;
}

export interface CartItemDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export interface CartItemButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export interface CartProps {
  className?: string;
  emptyMessage?: React.ReactNode;
}

export interface CheckoutProps {
  className?: string;
  children?: React.ReactNode;
}

export interface HasProps {
  feature?: string;
  plan?: string;
  user: string; // email
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
