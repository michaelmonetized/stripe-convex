// Types
export type {
  // Coupon types
  CouponRule,
  CouponDiscountType,
  AppliedCoupon,
  // Plan types
  Plan,
  PlanFeature,
  // Cart types
  Cart as CartState,
  CartItem,
  // Payment types
  Payment,
  PaymentStatus,
  Subscription,
  SubscriptionStatus,
  Order,
  Customer,
  // Webhook types
  WebhookEvent,
  WebhookEventType,
  // Config types
  StripeConvexConfig,
  StripeConvexContextValue,
  // Component props
  PayProps,
  AddToCartProps,
  CartItemTitleProps,
  CartItemPriceProps,
  CartItemDescriptionProps,
  CartItemButtonProps,
  CartItemPlanProps,
  CartProps,
  CheckoutProps,
  HasProps,
} from "./types/index.js";

// React components
export {
  // Provider and hooks
  StripeConvexProvider,
  useStripeConvex,
  useCart,
  useCoupon,
  useCheckout,
  // Components
  Pay,
  AddToCart,
  CartItemTitle,
  CartItemPrice,
  CartItemDescription,
  CartItemButton,
  CartItemPlan,
  Cart,
  Checkout,
  Has,
  useHasAccess,
} from "./components/index.js";

// Convex exports (for users to integrate with their Convex backend)
export {
  // Schema
  stripeConvexTables,
  // Function handlers
  customers,
  payments,
  subscriptions,
  orders,
  coupons,
  access,
  webhooks,
  // Stripe utilities
  createCheckoutSession,
  createPaymentIntent,
  createSubscription,
  cancelSubscription,
  getSubscription,
  verifyWebhookSignature,
  processWebhookEvent,
  // Coupon utilities
  validateCoupon,
  calculateDiscount,
  applyCouponToOrder,
} from "./convex/index.js";
