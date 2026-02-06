/**
 * Example webhook handler for stripe-convex
 * 
 * Copy this file to your convex/ directory as http.ts
 * File: convex/http.ts
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import Stripe from "stripe";
import {
  verifyWebhookSignature,
  processWebhookEvent,
  webhooks,
} from "stripe-convex/convex";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

const http = httpRouter();

/**
 * Stripe webhook endpoint
 * 
 * Configure this URL in your Stripe Dashboard:
 * https://your-convex-app.convex.site/stripe-webhook
 * 
 * Events to enable:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - charge.refunded
 */
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(
        stripe,
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    console.log(`Processing webhook: ${event.type} (${event.id})`);

    try {
      // Check idempotency - skip if already processed
      const processed = await ctx.runMutation(webhooks.hasProcessedEvent, {
        stripeEventId: event.id,
      });

      if (processed) {
        console.log(`Event already processed: ${event.id}`);
        return new Response("Already processed", { status: 200 });
      }

      // Record the event
      await ctx.runMutation(webhooks.recordEvent, {
        stripeEventId: event.id,
        type: event.type,
        data: event.data.object as Record<string, unknown>,
      });

      // Process the event
      const eventData = processWebhookEvent(event);

      if (eventData) {
        switch (event.type) {
          case "checkout.session.completed":
            await ctx.runMutation(webhooks.processCheckoutCompleted, {
              sessionId: eventData.data.sessionId as string,
              customerEmail: eventData.data.customerEmail as string,
              paymentIntentId: eventData.data.paymentIntentId as string | undefined,
              subscriptionId: eventData.data.subscriptionId as string | undefined,
              amountTotal: eventData.data.amountTotal as number,
              currency: eventData.data.currency as string,
              metadata: eventData.data.metadata,
            });
            console.log(`Checkout completed for ${eventData.data.customerEmail}`);
            break;

          case "customer.subscription.created":
          case "customer.subscription.updated":
            await ctx.runMutation(webhooks.processSubscriptionUpdate, {
              stripeSubscriptionId: eventData.data.stripeSubscriptionId as string,
              status: eventData.data.status as string,
              currentPeriodStart: eventData.data.currentPeriodStart as number,
              currentPeriodEnd: eventData.data.currentPeriodEnd as number,
              cancelAtPeriodEnd: eventData.data.cancelAtPeriodEnd as boolean | undefined,
            });
            console.log(`Subscription updated: ${eventData.data.stripeSubscriptionId}`);
            break;

          case "customer.subscription.deleted":
            await ctx.runMutation(webhooks.processSubscriptionDeleted, {
              stripeSubscriptionId: eventData.data.stripeSubscriptionId as string,
            });
            console.log(`Subscription deleted: ${eventData.data.stripeSubscriptionId}`);
            break;

          case "charge.refunded":
            await ctx.runMutation(webhooks.processRefund, {
              chargeId: eventData.data.chargeId as string,
              paymentIntentId: eventData.data.paymentIntentId as string | undefined,
            });
            console.log(`Refund processed: ${eventData.data.chargeId}`);
            break;

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }
      }

      // Mark as processed
      await ctx.runMutation(webhooks.markProcessed, {
        stripeEventId: event.id,
      });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook processing error:", error);

      // Mark as processed with error
      await ctx.runMutation(webhooks.markProcessed, {
        stripeEventId: event.id,
        error: (error as Error).message,
      });

      // Return 200 to prevent Stripe from retrying
      // The error is logged and can be investigated
      return new Response("Processed with error", { status: 200 });
    }
  }),
});

/**
 * Health check endpoint
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
