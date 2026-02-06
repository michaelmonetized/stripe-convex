/**
 * Example Pricing Page using stripe-convex components
 * 
 * This shows how to build a complete pricing page with:
 * - Plan cards with feature lists
 * - Quick checkout buttons
 * - Access-gated features
 */

"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Pay, Has, useHasAccess } from "stripe-convex";
import { plans, formatPrice } from "../lib/payment-config";

interface PricingPageProps {
  userEmail?: string;
}

export function PricingPage({ userEmail }: PricingPageProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const quickCheckout = useAction(api.stripe.quickCheckout);

  // Check which plan user already has
  const userPlans = useQuery(
    api.stripe.getUserPlans,
    userEmail ? { email: userEmail } : "skip"
  );

  const activePlanIds = userPlans?.map((p) => p.planId) ?? [];

  const handleSubscribe = async (planId: string) => {
    if (!userEmail) {
      // Redirect to sign in
      window.location.href = "/sign-in?redirect=/pricing";
      return;
    }

    setLoading(planId);
    try {
      const result = await quickCheckout({ email: userEmail, planId });
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pricing-page">
      <h1>Choose Your Plan</h1>
      <p>Start free, upgrade when you're ready</p>

      <div className="pricing-grid">
        {plans
          .filter((p) => p.active)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((plan) => {
            const isCurrentPlan = activePlanIds.includes(plan.id);
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                className={`pricing-card ${isCurrentPlan ? "current" : ""}`}
              >
                <h2>{plan.name}</h2>
                <p className="description">{plan.description}</p>

                <div className="price">
                  <span className="amount">{formatPrice(plan.price)}</span>
                  {plan.isSubscription && plan.interval && (
                    <span className="interval">/{plan.interval}</span>
                  )}
                  {!plan.isSubscription && plan.price > 0 && (
                    <span className="interval">one-time</span>
                  )}
                </div>

                <ul className="features">
                  {plan.features.map((feature) => (
                    <li key={feature.id}>
                      <span className="check">✓</span>
                      {feature.name}
                      {feature.limit && feature.limit > 0 && (
                        <span className="limit">
                          ({feature.limit.toLocaleString()})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <button className="btn current" disabled>
                    Current Plan
                  </button>
                ) : plan.price === 0 ? (
                  <button className="btn free" disabled>
                    Free Forever
                  </button>
                ) : (
                  <button
                    className="btn subscribe"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Loading..."
                      : plan.isSubscription
                        ? "Subscribe"
                        : "Buy Now"}
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Example: Feature gating */}
      {userEmail && (
        <div className="feature-demo">
          <h2>Your Features</h2>

          <Has plan="pro" user={userEmail} fallback={<UpgradePrompt />}>
            <ProFeatures />
          </Has>

          <Has feature="api-access" user={userEmail}>
            <ApiDashboard />
          </Has>
        </div>
      )}
    </div>
  );
}

function ProFeatures() {
  return (
    <div className="pro-features">
      <h3>🎉 Pro Features Unlocked!</h3>
      <ul>
        <li>Unlimited projects</li>
        <li>10GB storage</li>
        <li>Priority support</li>
        <li>API access</li>
      </ul>
    </div>
  );
}

function ApiDashboard() {
  return (
    <div className="api-dashboard">
      <h3>API Dashboard</h3>
      <p>Your API key: sk_live_xxx...xxx</p>
      <p>Usage this month: 1,234 / 10,000 requests</p>
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div className="upgrade-prompt">
      <h3>Upgrade to Pro</h3>
      <p>Get access to all features with a Pro subscription.</p>
    </div>
  );
}

/**
 * Alternative: Using the Pay component for quick checkout
 */
export function QuickPurchase({ userEmail }: { userEmail: string }) {
  return (
    <div className="quick-purchase">
      <h2>Quick Purchase</h2>

      {/* One-time payment */}
      <Pay amount={2999} className="btn">
        Buy Widget - $29.99
      </Pay>

      {/* Subscription */}
      <Pay amount={1999} subscription planId="pro" className="btn">
        Subscribe to Pro - $19.99/month
      </Pay>
    </div>
  );
}
