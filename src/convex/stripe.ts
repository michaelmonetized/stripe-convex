/**
 * @module stripe-convex/convex/stripe
 * @description Stripe API utilities for checkout, payments, and subscriptions
 */

import Stripe from "stripe";
import type { CartItem, AppliedCoupon } from "../types/index.js";

/**
 * Parameters for creating a Stripe checkout session.
 */
export interface CreateCheckoutParams {
  /** Customer email address */
  email: string;
  /** Cart items to checkout */
  items: CartItem[];
  /** URL to redirect to after successful payment */
  successUrl: string;
  /** URL to redirect to if payment is cancelled */
  cancelUrl: string;
  /** Applied coupon details */
  coupon?: AppliedCoupon;
  /** Additional metadata to attach to the session */
  metadata?: Record<string, string>;
  /** Whether this checkout contains a subscription */
  isSubscription?: boolean;
  /** Plan ID for subscription checkouts */
  planId?: string;
}

/**
 * Gets or creates a Stripe customer by email.
 * 
 * Based on Theo's recommendation to ALWAYS have the customer defined
 * BEFORE starting checkout. The ephemerality of customer_email is a 
 * design flaw that causes split-brain issues.
 * 
 * @see https://github.com/t3dotgg/stripe-recommendations
 * 
 * @example
 * ```ts
 * const customer = await getOrCreateStripeCustomer(stripe, "user@example.com", {
 *   userId: "user_123", // Optional but recommended for apps with auth
 * });
 * ```
 */
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  // Check if customer already exists
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer with metadata
  // Theo: "DO NOT FORGET THIS" - always include userId in metadata if available
  return await stripe.customers.create({
    email,
    metadata: {
      ...metadata,
      email, // Include email in metadata for easy lookup
    },
  });
}

/**
 * Creates a Stripe Checkout Session for processing payments.
 * 
 * This should be called from a Convex action (not mutation) since it
 * makes external API calls to Stripe.
 * 
 * **Important:** This function pre-creates a Stripe customer before checkout,
 * following Theo's recommendation to avoid split-brain issues.
 * 
 * @param stripe - Initialized Stripe client
 * @param params - Checkout session parameters
 * @returns Stripe Checkout Session with redirect URL
 * 
 * @example
 * ```ts
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
 * const session = await createCheckoutSession(stripe, {
 *   email: "customer@example.com",
 *   items: [{ id: "1", title: "Pro Plan", price: 1999, quantity: 1, isSubscription: true }],
 *   successUrl: "https://example.com/success",
 *   cancelUrl: "https://example.com/cancel",
 *   isSubscription: true,
 *   planId: "pro",
 * });
 * // Redirect user to session.url
 * ```
 */
export async function createCheckoutSession(
  stripe: Stripe,
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  // CRITICAL: Always create customer BEFORE checkout (Theo's #1 recommendation)
  // This prevents split-brain issues where customer_email creates ephemeral customers
  const customer = await getOrCreateStripeCustomer(stripe, params.email, params.metadata);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.items.map(
    (item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.title,
          description: item.description,
        },
        unit_amount: item.price,
        ...(item.isSubscription && {
          recurring: {
            interval: "month", // Default to monthly
          },
        }),
      },
      quantity: item.quantity,
    })
  );

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: params.isSubscription ? "subscription" : "payment",
    customer: customer.id, // Use customer ID, NOT customer_email
    line_items: lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      ...params.metadata,
      email: params.email,
      planId: params.planId || "",
    },
  };

  // Apply discount if coupon is present
  if (params.coupon) {
    // Create a Stripe coupon on the fly
    const stripeCoupon = await stripe.coupons.create({
      ...(params.coupon.discountType === "percentage"
        ? { percent_off: params.coupon.discountValue }
        : { amount_off: params.coupon.discountValue, currency: "usd" }),
      duration: "once",
      metadata: {
        code: params.coupon.code,
      },
    });

    sessionParams.discounts = [{ coupon: stripeCoupon.id }];
  }

  return await stripe.checkout.sessions.create(sessionParams);
}

/**
 * Creates a Stripe PaymentIntent for direct payment processing.
 * Use this for custom payment flows instead of Checkout.
 * 
 * @param stripe - Initialized Stripe client
 * @param params - Payment intent parameters
 * @returns Stripe PaymentIntent with client_secret for frontend
 * 
 * @example
 * ```ts
 * const paymentIntent = await createPaymentIntent(stripe, {
 *   email: "customer@example.com",
 *   amount: 1999, // $19.99
 *   currency: "usd",
 * });
 * // Use paymentIntent.client_secret on frontend with Stripe.js
 * ```
 */
export async function createPaymentIntent(
  stripe: Stripe,
  params: {
    email: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.PaymentIntent> {
  // Get or create customer
  const customers = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });

  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email: params.email,
    });
    customerId = customer.id;
  }

  return await stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency || "usd",
    customer: customerId,
    metadata: {
      ...params.metadata,
      email: params.email,
    },
  });
}

/**
 * Creates a Stripe subscription for a customer.
 * 
 * @param stripe - Initialized Stripe client
 * @param params - Subscription parameters
 * @returns Stripe Subscription object
 * 
 * @example
 * ```ts
 * const subscription = await createSubscription(stripe, {
 *   email: "customer@example.com",
 *   priceId: "price_1234567890", // Stripe Price ID
 *   trialDays: 14, // Optional trial period
 * });
 * ```
 */
export async function createSubscription(
  stripe: Stripe,
  params: {
    email: string;
    priceId: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.Subscription> {
  // Get or create customer
  const customers = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });

  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email: params.email,
    });
    customerId = customer.id;
  }

  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: params.priceId }],
    trial_period_days: params.trialDays,
    metadata: {
      ...params.metadata,
      email: params.email,
    },
  });
}

/**
 * Cancels a Stripe subscription.
 * 
 * @param stripe - Initialized Stripe client
 * @param subscriptionId - Stripe Subscription ID
 * @param atPeriodEnd - If true, cancel at end of billing period (default: true)
 * @returns Updated Stripe Subscription
 * 
 * @example
 * ```ts
 * // Cancel immediately
 * await cancelSubscription(stripe, "sub_1234567890", false);
 * 
 * // Cancel at end of billing period
 * await cancelSubscription(stripe, "sub_1234567890", true);
 * ```
 */
export async function cancelSubscription(
  stripe: Stripe,
  subscriptionId: string,
  atPeriodEnd = true
): Promise<Stripe.Subscription> {
  if (atPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  return await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Retrieves a Stripe subscription by ID.
 * 
 * @param stripe - Initialized Stripe client
 * @param subscriptionId - Stripe Subscription ID
 * @returns Stripe Subscription object
 */
export async function getSubscription(
  stripe: Stripe,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Subscription state as stored in KV/database.
 * Based on Theo's STRIPE_SUB_CACHE pattern.
 */
export type SubscriptionState =
  | {
      subscriptionId: string;
      status: Stripe.Subscription.Status;
      priceId: string | null;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
      paymentMethod: {
        brand: string | null;
        last4: string | null;
      } | null;
    }
  | { status: "none" };

/**
 * Syncs all Stripe data for a customer to local database.
 * 
 * Based on Theo's `syncStripeDataToKV` pattern. Call this function from:
 * 1. Your `/success` page (eager sync before webhooks arrive)
 * 2. Your webhook handlers (for redundancy)
 * 
 * This single function approach prevents split-brain states where
 * different parts of your app have different views of subscription state.
 * 
 * @see https://github.com/t3dotgg/stripe-recommendations
 * 
 * @example
 * ```ts
 * // In your success page
 * const subData = await syncCustomerData(stripe, stripeCustomerId);
 * // Store subData in your database
 * 
 * // In webhooks, call the same function
 * const subData = await syncCustomerData(stripe, customerId);
 * ```
 */
export async function syncCustomerData(
  stripe: Stripe,
  customerId: string
): Promise<SubscriptionState> {
  // Fetch latest subscription data from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: "all",
    expand: ["data.default_payment_method"],
  });

  if (subscriptions.data.length === 0) {
    return { status: "none" };
  }

  // If a user can have multiple subscriptions, that's your problem (Theo's words)
  const subscription = subscriptions.data[0];

  // Extract payment method info
  const paymentMethod = subscription.default_payment_method;
  
  // Get period from subscription items (first item)
  const item = subscription.items?.data?.[0];
  const periodStart = (item as any)?.current_period_start ?? subscription.created;
  const periodEnd = (item as any)?.current_period_end ?? (subscription.created + 30 * 24 * 60 * 60);

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: item?.price?.id ?? null,
    currentPeriodStart: periodStart * 1000,
    currentPeriodEnd: periodEnd * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    paymentMethod:
      paymentMethod && typeof paymentMethod !== "string"
        ? {
            brand: paymentMethod.card?.brand ?? null,
            last4: paymentMethod.card?.last4 ?? null,
          }
        : null,
  };
}

/**
 * Creates a Stripe Customer Portal session.
 * Use for subscription management (cancel, update payment method, view invoices).
 * 
 * Theo recommends using the Customer Portal for self-service subscription management.
 * 
 * @param stripe - Initialized Stripe client
 * @param customerId - Stripe Customer ID
 * @param returnUrl - URL to redirect after portal session
 * @returns Billing Portal Session with redirect URL
 * 
 * @example
 * ```ts
 * const session = await createPortalSession(
 *   stripe,
 *   "cus_1234567890",
 *   "https://example.com/account"
 * );
 * // Redirect user to session.url
 * ```
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

/**
 * Verifies the signature of a Stripe webhook request.
 * 
 * @param stripe - Initialized Stripe client
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header value
 * @param webhookSecret - Webhook endpoint secret from Stripe Dashboard
 * @returns Verified Stripe Event
 * @throws Error if signature verification fails
 * 
 * @example
 * ```ts
 * const event = verifyWebhookSignature(
 *   stripe,
 *   request.body,
 *   request.headers["stripe-signature"],
 *   process.env.STRIPE_WEBHOOK_SECRET
 * );
 * ```
 */
export function verifyWebhookSignature(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Events tracked by stripe-convex.
 * Based on Theo's recommended event list.
 * 
 * @see https://github.com/t3dotgg/stripe-recommendations
 */
export const TRACKED_EVENTS: Stripe.Event.Type[] = [
  // Checkout
  "checkout.session.completed",
  // Subscription lifecycle
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  // Invoice events
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  // Payment intents
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  // Refunds
  "charge.refunded",
];

/**
 * Processes a Stripe webhook event and extracts relevant data.
 * 
 * Supported events (based on Theo's recommendations):
 * - `checkout.session.completed` - Checkout completed
 * - `customer.subscription.*` - All subscription lifecycle events
 * - `invoice.*` - Invoice and payment events
 * - `payment_intent.*` - Payment status events
 * - `charge.refunded` - Refund processed
 * 
 * @param event - Stripe Event from webhook
 * @returns Processed event data or null if event type not supported
 * 
 * @example
 * ```ts
 * // Check if we should process this event
 * if (!TRACKED_EVENTS.includes(event.type)) return;
 * 
 * const eventData = processWebhookEvent(event);
 * if (eventData) {
 *   // Handle the event
 * }
 * ```
 */
export function processWebhookEvent(event: Stripe.Event): {
  type: string;
  data: Record<string, unknown>;
} | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: "checkout.session.completed",
        data: {
          sessionId: session.id,
          customerId: session.customer as string | undefined,
          customerEmail: session.customer_email || session.customer_details?.email,
          paymentIntentId: session.payment_intent as string | undefined,
          subscriptionId: session.subscription as string | undefined,
          amountTotal: session.amount_total,
          currency: session.currency,
          metadata: session.metadata,
        },
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      // Get period from subscription items (first item)
      const item = subscription.items?.data?.[0];
      const currentPeriodStart = item?.current_period_start 
        ? item.current_period_start * 1000 
        : Date.now();
      const currentPeriodEnd = item?.current_period_end 
        ? item.current_period_end * 1000 
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
      return {
        type: event.type,
        data: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          status: subscription.status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          priceId: item?.price?.id,
        },
      };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        type: "customer.subscription.deleted",
        data: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
        },
      };
    }

    // Additional subscription events (Theo's recommendations)
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.pending_update_applied":
    case "customer.subscription.pending_update_expired": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        type: event.type,
        data: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          status: subscription.status,
        },
      };
    }

    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        type: event.type,
        data: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : null,
        },
      };
    }

    // Invoice events
    // Note: In Stripe API v2024+, subscription info is in parent.subscription_details
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      // Handle both old (subscription) and new (parent.subscription_details) API structures
      const subDetails = invoice.parent?.subscription_details;
      const sub = subDetails?.subscription;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id;
      return {
        type: event.type,
        data: {
          invoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: subscriptionId,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
        },
      };
    }

    case "invoice.payment_failed":
    case "invoice.payment_action_required":
    case "invoice.marked_uncollectible": {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      const sub = subDetails?.subscription;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id;
      return {
        type: event.type,
        data: {
          invoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: subscriptionId,
          amountDue: invoice.amount_due,
          error: invoice.last_finalization_error?.message,
        },
      };
    }

    case "invoice.upcoming": {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      const sub = subDetails?.subscription;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id;
      return {
        type: event.type,
        data: {
          invoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: subscriptionId,
          amountDue: invoice.amount_due,
          dueDate: invoice.due_date ? invoice.due_date * 1000 : null,
        },
      };
    }

    // Payment intent events
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.succeeded",
        data: {
          paymentIntentId: paymentIntent.id,
          stripeCustomerId: paymentIntent.customer as string | undefined,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          customerEmail: paymentIntent.metadata?.email,
        },
      };
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.payment_failed",
        data: {
          paymentIntentId: paymentIntent.id,
          stripeCustomerId: paymentIntent.customer as string | undefined,
          error: paymentIntent.last_payment_error?.message,
        },
      };
    }

    case "payment_intent.canceled": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.canceled",
        data: {
          paymentIntentId: paymentIntent.id,
          stripeCustomerId: paymentIntent.customer as string | undefined,
          cancellationReason: paymentIntent.cancellation_reason,
        },
      };
    }

    // Refunds
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      return {
        type: "charge.refunded",
        data: {
          chargeId: charge.id,
          stripeCustomerId: charge.customer as string | undefined,
          paymentIntentId: charge.payment_intent as string | undefined,
          amountRefunded: charge.amount_refunded,
        },
      };
    }

    default:
      return null;
  }
}
