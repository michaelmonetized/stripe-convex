"use client";

import { useState } from "react";
import type { CheckoutProps } from "../types/index.js";
import { useCheckout } from "./context.js";

/**
 * Checkout component - email input and checkout button
 */
export function Checkout({ className, children }: CheckoutProps) {
  const { cart, setEmail, checkout } = useCheckout();
  const [email, setEmailInput] = useState(cart.email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value);
    setEmail(e.target.value);
    setError(null);
  };

  const handleCheckout = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    if (cart.items.length === 0) {
      setError("Your cart is empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await checkout();

      if (result?.url) {
        window.location.href = result.url;
      } else {
        setError("Failed to create checkout session");
      }
    } catch (err) {
      setError((err as Error).message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <div className="sc-checkout-email">
        <label htmlFor="sc-email-input" className="sc-email-label">
          Email
        </label>
        <input
          id="sc-email-input"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          className="sc-email-input"
          disabled={loading}
        />
      </div>

      {error && <p className="sc-checkout-error">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={loading || cart.items.length === 0}
        className="sc-checkout-button"
        type="button"
      >
        {loading
          ? "Processing..."
          : children || `Pay ${formatPrice(cart.total)}`}
      </button>

      <p className="sc-checkout-secure">
        🔒 Secure checkout powered by Stripe
      </p>
    </div>
  );
}
