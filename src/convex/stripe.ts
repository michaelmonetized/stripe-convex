import Stripe from "stripe";
import type { CartItem, AppliedCoupon } from "../types/index.js";

export interface CreateCheckoutParams {
  email: string;
  items: CartItem[];
  successUrl: string;
  cancelUrl: string;
  coupon?: AppliedCoupon;
  metadata?: Record<string, string>;
  isSubscription?: boolean;
  planId?: string;
}

/**
 * Create a Stripe checkout session
 * This should be called from a Convex action (not mutation)
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
 * Create a payment intent for direct payment (without checkout)
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
 * Create a subscription
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
 * Cancel a subscription
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
 * Get subscription details
 */
export async function getSubscription(
  stripe: Stripe,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Verify webhook signature
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
 * Process a Stripe webhook event
 * Returns the processed data to be stored in Convex
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
