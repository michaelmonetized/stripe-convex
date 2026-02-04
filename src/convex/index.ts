// Schema exports
export { stripeConvexTables } from "./schema.js";
export type {
  // Re-export validators for use in app schema
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
  createCheckoutSession,
  createPaymentIntent,
  createSubscription,
  cancelSubscription,
  getSubscription,
  verifyWebhookSignature,
  processWebhookEvent,
} from "./stripe.js";

// Coupon utilities
export {
  validateCoupon,
  calculateDiscount,
  applyCouponToOrder,
} from "./coupons.js";
