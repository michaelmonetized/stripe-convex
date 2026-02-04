# Usage Examples

Complete examples for common stripe-convex use cases.

## Basic Shop with Cart

A simple e-commerce setup with products, cart, and checkout.

### Product Card

```tsx
// components/ProductCard.tsx
import { useCart } from "stripe-convex";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();

  return (
    <div className="product-card">
      <img src={product.image} alt={product.title} />
      <h3>{product.title}</h3>
      <p>{product.description}</p>
      <span className="price">${(product.price / 100).toFixed(2)}</span>
      
      <button
        onClick={() => addToCart({
          title: product.title,
          description: product.description,
          price: product.price,
          metadata: { productId: product.id },
        })}
      >
        Add to Cart
      </button>
    </div>
  );
}
```

### Shopping Cart Page

```tsx
// pages/cart.tsx
import { Cart, Checkout } from "stripe-convex";
import Link from "next/link";

export default function CartPage() {
  return (
    <div className="cart-page">
      <h1>Your Cart</h1>
      
      <Cart
        className="cart-items"
        emptyMessage={
          <div className="empty-cart">
            <p>Your cart is empty</p>
            <Link href="/shop">Continue Shopping</Link>
          </div>
        }
      />
      
      <div className="checkout-section">
        <Checkout className="checkout-form">
          Proceed to Checkout
        </Checkout>
      </div>
    </div>
  );
}
```

### Mini Cart Header

```tsx
// components/MiniCart.tsx
import { useCart } from "stripe-convex";
import Link from "next/link";

export function MiniCart() {
  const { cart } = useCart();
  
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link href="/cart" className="mini-cart">
      <span className="cart-icon">🛒</span>
      {itemCount > 0 && (
        <>
          <span className="item-count">{itemCount}</span>
          <span className="cart-total">
            ${(cart.total / 100).toFixed(2)}
          </span>
        </>
      )}
    </Link>
  );
}
```

---

## Pricing Page with Subscriptions

A pricing page with multiple plans and subscription checkout.

### Pricing Configuration

```typescript
// lib/payment-config.ts
import type { Plan, StripeConvexConfig } from "stripe-convex";

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started for free",
    price: 0,
    isSubscription: false,
    features: [
      { id: "projects", name: "Projects", limit: 3 },
      { id: "storage", name: "Storage", limit: 100 }, // 100MB
    ],
    sortOrder: 0,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For professionals",
    price: 1999, // $19.99/month
    interval: "month",
    isSubscription: true,
    features: [
      { id: "projects", name: "Unlimited Projects" },
      { id: "storage", name: "Storage", limit: 10000 }, // 10GB
      { id: "priority-support", name: "Priority Support" },
      { id: "api-access", name: "API Access", limit: 10000 },
    ],
    sortOrder: 1,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large teams",
    price: 9999, // $99.99/month
    interval: "month",
    isSubscription: true,
    features: [
      { id: "projects", name: "Unlimited Projects" },
      { id: "storage", name: "Unlimited Storage" },
      { id: "priority-support", name: "24/7 Support" },
      { id: "api-access", name: "Unlimited API Access" },
      { id: "sso", name: "SSO/SAML" },
      { id: "audit-logs", name: "Audit Logs" },
    ],
    sortOrder: 2,
  },
];

export const config: StripeConvexConfig = {
  plans,
  coupons: [],
  currency: "usd",
  successUrl: "https://yourapp.com/dashboard?welcome=true",
  cancelUrl: "https://yourapp.com/pricing",
};
```

### Pricing Page

```tsx
// pages/pricing.tsx
import { Pay } from "stripe-convex";
import { plans } from "../lib/payment-config";

export default function PricingPage() {
  return (
    <div className="pricing-page">
      <h1>Choose Your Plan</h1>
      
      <div className="plans-grid">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const formatPrice = () => {
    if (plan.price === 0) return "Free";
    const price = (plan.price / 100).toFixed(2);
    return plan.interval ? `$${price}/${plan.interval}` : `$${price}`;
  };

  return (
    <div className={`plan-card ${plan.id}`}>
      <h2>{plan.name}</h2>
      <p className="description">{plan.description}</p>
      <div className="price">{formatPrice()}</div>
      
      <ul className="features">
        {plan.features.map((feature) => (
          <li key={feature.id}>
            ✓ {feature.name}
            {feature.limit && feature.limit > 0 && ` (${feature.limit})`}
          </li>
        ))}
      </ul>
      
      {plan.price > 0 ? (
        <Pay
          amount={plan.price}
          subscription={plan.isSubscription}
          planId={plan.id}
          className="subscribe-button"
        >
          {plan.isSubscription ? "Subscribe" : "Buy Now"}
        </Pay>
      ) : (
        <button className="free-button">Get Started</button>
      )}
    </div>
  );
}
```

---

## Feature Gating

Conditionally show features based on user's subscription.

### Gated Dashboard

```tsx
// pages/dashboard.tsx
import { Has } from "stripe-convex";
import { useCurrentUser } from "../hooks/useCurrentUser";

export default function Dashboard() {
  const user = useCurrentUser();
  
  if (!user) return <LoginPrompt />;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      {/* Always visible */}
      <BasicStats />
      
      {/* Pro feature */}
      <Has 
        plan="pro" 
        user={user.email}
        fallback={<UpgradeCard feature="Advanced Analytics" plan="pro" />}
      >
        <AdvancedAnalytics />
      </Has>
      
      {/* Enterprise feature */}
      <Has 
        feature="audit-logs" 
        user={user.email}
        fallback={<UpgradeCard feature="Audit Logs" plan="enterprise" />}
      >
        <AuditLogs />
      </Has>
      
      {/* API access with limit display */}
      <Has feature="api-access" user={user.email}>
        <ApiUsagePanel />
      </Has>
    </div>
  );
}

function UpgradeCard({ feature, plan }: { feature: string; plan: string }) {
  return (
    <div className="upgrade-card">
      <h3>Unlock {feature}</h3>
      <p>Upgrade to {plan} to access this feature.</p>
      <a href="/pricing">View Plans</a>
    </div>
  );
}
```

### Using the Hook

```tsx
// components/ApiDashboard.tsx
import { useHasAccess } from "stripe-convex";
import { useCurrentUser } from "../hooks/useCurrentUser";

export function ApiDashboard() {
  const user = useCurrentUser();
  const { hasAccess, loading } = useHasAccess({
    feature: "api-access",
    user: user?.email || "",
  });

  if (loading) return <Skeleton />;
  
  if (!hasAccess) {
    return (
      <div className="locked-feature">
        <h2>API Access</h2>
        <p>API access is available on Pro and Enterprise plans.</p>
        <a href="/pricing" className="upgrade-link">Upgrade Now</a>
      </div>
    );
  }

  return (
    <div className="api-dashboard">
      <h2>API Dashboard</h2>
      <ApiKeyManager />
      <UsageStats />
      <Documentation />
    </div>
  );
}
```

---

## Coupon Promotions

Implementing promotional campaigns with coupons.

### Campaign Configuration

```typescript
// lib/payment-config.ts
export const coupons: CouponRule[] = [
  // Launch promotion
  {
    code: "LAUNCH50",
    discountType: "percentage",
    discountValue: 50,
    description: "50% off - Launch Special",
    maxUses: 1000,
    expiresAt: "2025-03-01",
    subscriptionOnly: true,
  },
  
  // Referral program
  {
    code: "FRIEND25",
    discountType: "percentage",
    discountValue: 25,
    description: "25% off from a friend",
    maxUsesPerEmail: 1,
  },
  
  // Newsletter signup
  {
    code: "NEWSLETTER10",
    discountType: "fixed",
    discountValue: 1000, // $10 off
    description: "$10 off for subscribers",
    maxUsesPerEmail: 1,
    minOrderAmount: 2000,
  },
];
```

### Promotion Banner

```tsx
// components/PromoBanner.tsx
export function PromoBanner() {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  return (
    <div className="promo-banner">
      <p>
        🎉 Launch Special! Use code <strong>LAUNCH50</strong> for 50% off 
        your first month. Limited to first 1000 customers!
      </p>
      <button onClick={() => setDismissed(true)}>×</button>
    </div>
  );
}
```

### Auto-Apply Coupon from URL

```tsx
// pages/pricing.tsx
import { useEffect } from "react";
import { useCoupon } from "stripe-convex";
import { useSearchParams } from "next/navigation";

export default function PricingPage() {
  const searchParams = useSearchParams();
  const { applyCoupon } = useCoupon();
  
  useEffect(() => {
    const code = searchParams.get("coupon");
    if (code) {
      applyCoupon(code).then((result) => {
        if (result) {
          toast.success(`Coupon ${code} applied!`);
        }
      });
    }
  }, [searchParams, applyCoupon]);

  // ... rest of pricing page
}

// Link: yourapp.com/pricing?coupon=LAUNCH50
```

---

## Custom Checkout Flow

Building a fully custom checkout experience.

### Multi-Step Checkout

```tsx
// pages/checkout.tsx
import { useState } from "react";
import { useCart, useCoupon, useCheckout } from "stripe-convex";

export default function CheckoutPage() {
  const [step, setStep] = useState(1);
  
  return (
    <div className="checkout-page">
      <Steps current={step} />
      
      {step === 1 && <CartReview onNext={() => setStep(2)} />}
      {step === 2 && <CouponStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <PaymentStep onBack={() => setStep(2)} />}
    </div>
  );
}

function CartReview({ onNext }: { onNext: () => void }) {
  const { cart, updateQuantity, removeFromCart } = useCart();
  
  return (
    <div className="cart-review">
      <h2>Review Your Order</h2>
      
      {cart.items.map((item) => (
        <div key={item.id} className="cart-item">
          <span>{item.title}</span>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
            min={1}
          />
          <span>${((item.price * item.quantity) / 100).toFixed(2)}</span>
          <button onClick={() => removeFromCart(item.id)}>Remove</button>
        </div>
      ))}
      
      <div className="subtotal">
        Subtotal: ${(cart.subtotal / 100).toFixed(2)}
      </div>
      
      <button onClick={onNext} disabled={cart.items.length === 0}>
        Continue
      </button>
    </div>
  );
}

function CouponStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();
  const { cart } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleApply = async () => {
    setError("");
    const result = await applyCoupon(code);
    if (!result) {
      setError("Invalid or expired coupon code");
    } else {
      setCode("");
    }
  };

  return (
    <div className="coupon-step">
      <h2>Apply Coupon (Optional)</h2>
      
      {appliedCoupon ? (
        <div className="applied-coupon">
          <span>✓ {appliedCoupon.code} applied</span>
          <span>-${(appliedCoupon.discountAmount / 100).toFixed(2)}</span>
          <button onClick={removeCoupon}>Remove</button>
        </div>
      ) : (
        <div className="coupon-input">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
          />
          <button onClick={handleApply}>Apply</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
      
      <div className="order-summary">
        <div>Subtotal: ${(cart.subtotal / 100).toFixed(2)}</div>
        {cart.discount > 0 && (
          <div className="discount">Discount: -${(cart.discount / 100).toFixed(2)}</div>
        )}
        <div className="total">Total: ${(cart.total / 100).toFixed(2)}</div>
      </div>
      
      <div className="buttons">
        <button onClick={onBack}>Back</button>
        <button onClick={onNext}>Continue to Payment</button>
      </div>
    </div>
  );
}

function PaymentStep({ onBack }: { onBack: () => void }) {
  const { cart, setEmail, checkout } = useCheckout();
  const [email, setEmailInput] = useState(cart.email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);
    setError("");
    setEmail(email);

    try {
      const result = await checkout();
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setError("Failed to create checkout session");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="payment-step">
      <h2>Payment</h2>
      
      <div className="email-input">
        <label>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      
      <div className="final-total">
        Total: ${(cart.total / 100).toFixed(2)}
      </div>
      
      {error && <p className="error">{error}</p>}
      
      <div className="buttons">
        <button onClick={onBack} disabled={loading}>Back</button>
        <button onClick={handleCheckout} disabled={loading}>
          {loading ? "Redirecting to Stripe..." : "Pay with Stripe"}
        </button>
      </div>
      
      <p className="secure-note">🔒 Secure payment powered by Stripe</p>
    </div>
  );
}
```

---

## Success Page

Handling the post-checkout redirect.

```tsx
// pages/success.tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import confetti from "canvas-confetti";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const sessionId = searchParams.get("session_id");
  
  const order = useQuery(api.orders.get, orderId ? { id: orderId } : "skip");
  
  useEffect(() => {
    // Celebration!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="success-page">
      <div className="success-icon">✓</div>
      <h1>Thank You!</h1>
      <p>Your order has been confirmed.</p>
      
      {order && (
        <div className="order-details">
          <h2>Order Summary</h2>
          {order.items.map((item) => (
            <div key={item.id}>
              {item.title} x {item.quantity} - ${((item.price * item.quantity) / 100).toFixed(2)}
            </div>
          ))}
          <div className="total">
            Total: ${(order.total / 100).toFixed(2)}
          </div>
        </div>
      )}
      
      <p>A confirmation email has been sent to your inbox.</p>
      
      <div className="actions">
        <a href="/dashboard">Go to Dashboard</a>
        <a href="/shop">Continue Shopping</a>
      </div>
    </div>
  );
}
```
