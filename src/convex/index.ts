// Schema exports
export {
  stripeConvexTables,
  metadataValidator,
  planValidator,
  planFeatureValidator,
  webhookEventDataValidator,
  paymentStatusValidator,
  subscriptionStatusValidator,
  orderStatusValidator,
  cartItemValidator,
} from "./schema.js";

// Function handlers (for use with internalMutation/internalQuery)
export * as customers from "./customers.js";
export * as payments from "./payments.js";
export * as subscriptions from "./subscriptions.js";
export * as orders from "./orders.js";
export * as coupons from "./coupons.js";
export * as access from "./access.js";
export * as webhooks from "./webhooks.js";

// Stripe utilities
export {
  // Customer management (Theo's #1 recommendation)
  getOrCreateStripeCustomer,
  // Checkout and payments
  createCheckoutSession,
  createPaymentIntent,
  createSubscription,
  cancelSubscription,
  getSubscription,
  // Sync function (Theo's syncStripeDataToKV pattern)
  syncCustomerData,
  // Customer portal
  createPortalSession,
  // Webhook processing
  verifyWebhookSignature,
  processWebhookEvent,
  TRACKED_EVENTS,
} from "./stripe.js";

// Types
export type { SubscriptionState } from "./stripe.js";

// Coupon utilities
export {
  validateCoupon,
  calculateDiscount,
  applyCouponToOrder,
} from "./coupons.js";
