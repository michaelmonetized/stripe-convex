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
 * Creates a Stripe Checkout Session for processing payments.
 * 
 * This should be called from a Convex action (not mutation) since it
 * makes external API calls to Stripe.
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
    customer_email: params.email,
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
 * Processes a Stripe webhook event and extracts relevant data.
 * 
 * Supported events:
 * - `checkout.session.completed` - Checkout completed
 * - `customer.subscription.created` - New subscription
 * - `customer.subscription.updated` - Subscription updated
 * - `customer.subscription.deleted` - Subscription cancelled
 * - `payment_intent.succeeded` - Payment successful
 * - `payment_intent.payment_failed` - Payment failed
 * - `charge.refunded` - Payment refunded
 * 
 * @param event - Stripe Event from webhook
 * @returns Processed event data or null if event type not supported
 * 
 * @example
 * ```ts
 * const eventData = processWebhookEvent(event);
 * if (eventData) {
 *   switch (event.type) {
 *     case "checkout.session.completed":
 *       await handleCheckoutCompleted(eventData.data);
 *       break;
 *   }
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
          status: subscription.status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        type: "customer.subscription.deleted",
        data: {
          stripeSubscriptionId: subscription.id,
        },
      };
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment_intent.succeeded",
        data: {
          paymentIntentId: paymentIntent.id,
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
          error: paymentIntent.last_payment_error?.message,
        },
      };
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      return {
        type: "charge.refunded",
        data: {
          chargeId: charge.id,
          paymentIntentId: charge.payment_intent as string | undefined,
        },
      };
    }

    default:
      return null;
  }
}
