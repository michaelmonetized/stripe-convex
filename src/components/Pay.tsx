"use client";

import { useState } from "react";
import type { PayProps } from "../types/index.js";
import { useStripeConvex } from "./context.js";

/**
 * Pay component for quick one-time or subscription payments
 * Wraps children with a click handler that triggers checkout
 */
export function Pay({
  amount,
  subscription = false,
  planId,
  children,
  onSuccess: _onSuccess,
  onError,
  className,
}: PayProps) {
  // Note: onSuccess is available for future use when we implement
  // return URL handling with success callback
  const { addToCart, checkout, clearCart, setEmail, cart } = useStripeConvex();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    // Check if email is set
    if (!cart.email) {
      const email = window.prompt("Enter your email to continue:");
      if (!email) return;
      setEmail(email);
    }

    setLoading(true);

    try {
      // Clear existing cart and add this item
      clearCart();
      addToCart({
        title: subscription ? `${planId || "Subscription"} Plan` : "Payment",
        price: amount,
        isSubscription: subscription,
        planId,
      });

      const result = await checkout();

      if (result?.url) {
        window.location.href = result.url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      onError?.(error as Error);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={{ cursor: loading ? "wait" : "pointer" }}
    >
      {loading ? "Processing..." : children}
    </button>
  );
}
