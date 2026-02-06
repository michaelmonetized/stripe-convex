/**
 * Example Shop Page with Cart functionality
 * 
 * This demonstrates the full cart experience with:
 * - AddToCart compound components
 * - Cart display with quantity controls
 * - Coupon code input
 * - Checkout flow
 */

"use client";

import {
  AddToCart,
  CartItemTitle,
  CartItemPrice,
  CartItemDescription,
  CartItemButton,
  Cart,
  Checkout,
  useCart,
  useCoupon,
} from "stripe-convex";

// Example products
const products = [
  {
    id: "widget-basic",
    title: "Basic Widget",
    description: "A simple widget for everyday use",
    price: 999, // $9.99
  },
  {
    id: "widget-pro",
    title: "Pro Widget",
    description: "Advanced features for power users",
    price: 2499, // $24.99
  },
  {
    id: "widget-enterprise",
    title: "Enterprise Widget",
    description: "Full-featured solution for teams",
    price: 4999, // $49.99
  },
];

export function ShopPage() {
  return (
    <div className="shop-page">
      <h1>Widget Shop</h1>

      <div className="shop-layout">
        {/* Product Grid */}
        <div className="products">
          <h2>Products</h2>
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="cart-sidebar">
          <h2>Your Cart</h2>
          <Cart
            className="cart"
            emptyMessage={
              <div className="empty-cart">
                <p>Your cart is empty</p>
                <p>Add some widgets to get started!</p>
              </div>
            }
          />

          <div className="checkout-section">
            <Checkout className="checkout">
              Complete Purchase
            </Checkout>
          </div>
        </div>
      </div>

      {/* Cart Summary (using hooks directly) */}
      <CartSummary />
    </div>
  );
}

/**
 * Product Card using AddToCart compound component
 */
function ProductCard({ product }: { product: typeof products[0] }) {
  return (
    <AddToCart className="product-card">
      <CartItemTitle className="product-title">{product.title}</CartItemTitle>
      <CartItemDescription className="product-description">
        {product.description}
      </CartItemDescription>
      <CartItemPrice price={product.price} className="product-price" />
      <CartItemButton className="add-btn">Add to Cart</CartItemButton>
    </AddToCart>
  );
}

/**
 * Cart summary using hooks directly for custom UI
 */
function CartSummary() {
  const { cart, clearCart } = useCart();
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <div className="cart-summary-custom">
      <h3>Order Summary</h3>

      <div className="summary-lines">
        <div className="line">
          <span>Items ({cart.items.reduce((sum, i) => sum + i.quantity, 0)})</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>

        {cart.discount > 0 && (
          <div className="line discount">
            <span>
              Discount
              {appliedCoupon && ` (${appliedCoupon.code})`}
            </span>
            <span>-{formatPrice(cart.discount)}</span>
          </div>
        )}

        <div className="line total">
          <span>Total</span>
          <span>{formatPrice(cart.total)}</span>
        </div>
      </div>

      {/* Coupon Input */}
      <CouponInput />

      {/* Clear Cart */}
      <button onClick={clearCart} className="clear-btn">
        Clear Cart
      </button>
    </div>
  );
}

/**
 * Custom coupon input component
 */
function CouponInput() {
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await applyCoupon(code.trim());
      if (!result) {
        setError("Invalid or expired coupon code");
      } else {
        setCode("");
      }
    } catch (err) {
      setError("Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="applied-coupon">
        <span>
          ✓ <strong>{appliedCoupon.code}</strong>
          {appliedCoupon.description && ` - ${appliedCoupon.description}`}
        </span>
        <button onClick={removeCoupon} className="remove-coupon">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="coupon-input">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Coupon code"
        disabled={loading}
      />
      <button onClick={handleApply} disabled={loading || !code.trim()}>
        {loading ? "..." : "Apply"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// Import useState at the top
import { useState } from "react";
