"use client";

import { useState } from "react";
import type { CartProps } from "../types/index.js";
import { useCart, useCoupon } from "./context.js";

/**
 * Cart component - displays cart items with quantity controls
 */
export function Cart({ className, emptyMessage }: CartProps) {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setApplyingCoupon(true);
    setCouponError(null);

    try {
      const result = await applyCoupon(couponCode.trim());
      if (!result) {
        setCouponError("Invalid or expired coupon code");
      } else {
        setCouponCode("");
      }
    } catch (error) {
      setCouponError("Failed to apply coupon");
    } finally {
      setApplyingCoupon(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className={className}>
        {emptyMessage || <p>Your cart is empty</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Cart Items */}
      <div className="sc-cart-items">
        {cart.items.map((item) => (
          <div key={item.id} className="sc-cart-item">
            <div className="sc-cart-item-info">
              <span className="sc-cart-item-title">{item.title}</span>
              {item.description && (
                <span className="sc-cart-item-description">{item.description}</span>
              )}
              <span className="sc-cart-item-price">{formatPrice(item.price)}</span>
            </div>
            <div className="sc-cart-item-controls">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="sc-quantity-btn"
                type="button"
              >
                -
              </button>
              <span className="sc-quantity">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="sc-quantity-btn"
                type="button"
              >
                +
              </button>
              <button
                onClick={() => removeFromCart(item.id)}
                className="sc-remove-btn"
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon Section */}
      <div className="sc-coupon-section">
        {appliedCoupon ? (
          <div className="sc-applied-coupon">
            <span>
              Coupon: <strong>{appliedCoupon.code}</strong>
              {appliedCoupon.description && ` - ${appliedCoupon.description}`}
            </span>
            <button onClick={removeCoupon} className="sc-remove-coupon" type="button">
              Remove
            </button>
          </div>
        ) : (
          <div className="sc-coupon-input">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Coupon code"
              className="sc-coupon-field"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={applyingCoupon || !couponCode.trim()}
              className="sc-apply-coupon"
              type="button"
            >
              {applyingCoupon ? "Applying..." : "Apply"}
            </button>
          </div>
        )}
        {couponError && <p className="sc-coupon-error">{couponError}</p>}
      </div>

      {/* Cart Summary */}
      <div className="sc-cart-summary">
        <div className="sc-summary-row">
          <span>Subtotal</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>
        {cart.discount > 0 && (
          <div className="sc-summary-row sc-discount">
            <span>Discount</span>
            <span>-{formatPrice(cart.discount)}</span>
          </div>
        )}
        <div className="sc-summary-row sc-total">
          <span>Total</span>
          <span>{formatPrice(cart.total)}</span>
        </div>
      </div>
    </div>
  );
}
