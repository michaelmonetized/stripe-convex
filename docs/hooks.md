# React Hooks

stripe-convex provides several hooks for building custom payment UIs.

## useStripeConvex

Full access to the stripe-convex context. Use when you need everything.

```tsx
import { useStripeConvex } from "stripe-convex";

function CustomPaymentUI() {
  const {
    config,           // StripeConvexConfig
    cart,             // Current cart state
    addToCart,        // Add item to cart
    removeFromCart,   // Remove item from cart
    updateQuantity,   // Update item quantity
    clearCart,        // Clear all items
    applyCoupon,      // Apply coupon code
    removeCoupon,     // Remove applied coupon
    setEmail,         // Set customer email
    checkout,         // Initiate checkout
    hasAccess,        // Check feature/plan access
  } = useStripeConvex();

  // Build your custom UI
}
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `config` | `StripeConvexConfig` | Current configuration |
| `cart` | `Cart` | Cart state (items, totals, coupon, email) |
| `addToCart` | `(item) => void` | Add item to cart |
| `removeFromCart` | `(itemId) => void` | Remove item by ID |
| `updateQuantity` | `(itemId, qty) => void` | Update quantity |
| `clearCart` | `() => void` | Clear all items |
| `applyCoupon` | `(code) => Promise<AppliedCoupon \| null>` | Apply coupon |
| `removeCoupon` | `() => void` | Remove coupon |
| `setEmail` | `(email) => void` | Set customer email |
| `checkout` | `() => Promise<{ url } \| null>` | Start checkout |
| `hasAccess` | `(params) => Promise<boolean>` | Check access |

---

## useCart

Cart operations only. Use for cart display and management.

```tsx
import { useCart } from "stripe-convex";

function CartDisplay() {
  const { 
    cart, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    clearCart 
  } = useCart();

  return (
    <div>
      <h2>Cart ({cart.items.length} items)</h2>
      
      {cart.items.map(item => (
        <div key={item.id}>
          <span>{item.title} x {item.quantity}</span>
          <span>${(item.price * item.quantity / 100).toFixed(2)}</span>
          
          <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
            -
          </button>
          <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
            +
          </button>
          <button onClick={() => removeFromCart(item.id)}>
            Remove
          </button>
        </div>
      ))}
      
      <div>Subtotal: ${(cart.subtotal / 100).toFixed(2)}</div>
      {cart.discount > 0 && (
        <div>Discount: -${(cart.discount / 100).toFixed(2)}</div>
      )}
      <div>Total: ${(cart.total / 100).toFixed(2)}</div>
      
      <button onClick={clearCart}>Clear Cart</button>
    </div>
  );
}
```

### Adding Items

```tsx
const { addToCart } = useCart();

// Basic item
addToCart({
  title: "Widget",
  price: 1999, // $19.99
});

// With description
addToCart({
  title: "Premium Widget",
  description: "Extra features included",
  price: 2999,
});

// Subscription item
addToCart({
  title: "Pro Plan",
  price: 999,
  planId: "pro",
  isSubscription: true,
});

// With metadata
addToCart({
  title: "Custom Widget",
  price: 4999,
  metadata: { color: "blue", size: "large" },
});
```

### Cart State

```tsx
const { cart } = useCart();

// Cart structure
{
  items: CartItem[],      // Array of items
  subtotal: number,       // Subtotal in cents (before discount)
  discount: number,       // Discount amount in cents
  total: number,          // Final total in cents
  appliedCoupon?: {       // Currently applied coupon
    code: string,
    discountType: "percentage" | "fixed",
    discountValue: number,
    discountAmount: number,
  },
  email?: string,         // Customer email
}

// CartItem structure
{
  id: string,             // Auto-generated ID
  title: string,
  description?: string,
  price: number,          // Price in cents
  quantity: number,
  planId?: string,
  isSubscription?: boolean,
  metadata?: Record<string, unknown>,
}
```

---

## useCoupon

Coupon-specific operations.

```tsx
import { useCoupon } from "stripe-convex";

function CouponInput() {
  const { appliedCoupon, applyCoupon, removeCoupon } = useCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleApply = async () => {
    setError("");
    const result = await applyCoupon(code);
    
    if (result) {
      setCode("");
      console.log(`Applied: ${result.code} - $${result.discountAmount / 100} off`);
    } else {
      setError("Invalid or expired coupon");
    }
  };

  if (appliedCoupon) {
    return (
      <div>
        <span>
          Coupon: {appliedCoupon.code} 
          ({appliedCoupon.discountType === "percentage" 
            ? `${appliedCoupon.discountValue}% off` 
            : `$${appliedCoupon.discountValue / 100} off`})
        </span>
        <button onClick={removeCoupon}>Remove</button>
      </div>
    );
  }

  return (
    <div>
      <input 
        value={code} 
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter coupon code"
      />
      <button onClick={handleApply}>Apply</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `appliedCoupon` | `AppliedCoupon \| undefined` | Currently applied coupon |
| `applyCoupon` | `(code: string) => Promise<AppliedCoupon \| null>` | Validate and apply |
| `removeCoupon` | `() => void` | Remove applied coupon |

---

## useCheckout

Checkout-specific operations.

```tsx
import { useCheckout } from "stripe-convex";

function CheckoutForm() {
  const { cart, setEmail, checkout } = useCheckout();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async () => {
    if (!cart.email) {
      setError("Email is required");
      return;
    }
    
    if (cart.items.length === 0) {
      setError("Cart is empty");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await checkout();
      
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setError("Failed to create checkout session");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="email"
        value={cart.email || ""}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
      />
      
      <div>Total: ${(cart.total / 100).toFixed(2)}</div>
      
      {error && <p className="error">{error}</p>}
      
      <button 
        onClick={handleCheckout} 
        disabled={loading || cart.items.length === 0}
      >
        {loading ? "Processing..." : "Checkout"}
      </button>
    </div>
  );
}
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `cart` | `Cart` | Current cart state |
| `setEmail` | `(email: string) => void` | Set customer email |
| `checkout` | `() => Promise<{ url } \| null>` | Initiate Stripe checkout |

---

## useHasAccess

Check if a user has access to a feature or plan.

```tsx
import { useHasAccess } from "stripe-convex";

function PremiumFeature() {
  const { hasAccess, loading } = useHasAccess({
    plan: "pro",
    user: "user@example.com",
  });

  if (loading) return <Spinner />;
  
  if (!hasAccess) {
    return <UpgradePrompt />;
  }

  return <FeatureContent />;
}

// Check feature access
function ApiDashboard() {
  const { hasAccess, loading } = useHasAccess({
    feature: "api-access",
    user: currentUser.email,
  });

  if (loading) return null;
  if (!hasAccess) return <UpgradePrompt feature="api-access" />;
  
  return <ApiUsageStats />;
}
```

### Arguments

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `feature` | `string` | No* | Feature ID to check |
| `plan` | `string` | No* | Plan ID to check |
| `user` | `string` | Yes | User email |

*At least one of `feature` or `plan` should be provided.

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `hasAccess` | `boolean \| null` | Access status (null while loading) |
| `loading` | `boolean` | Whether check is in progress |

---

## Usage Patterns

### Custom Product Card

```tsx
function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="product-card">
      <img src={product.image} alt={product.title} />
      <h3>{product.title}</h3>
      <p>{product.description}</p>
      <span>${(product.price / 100).toFixed(2)}</span>
      
      <button onClick={() => addToCart({
        title: product.title,
        description: product.description,
        price: product.price,
        metadata: { productId: product.id },
      })}>
        Add to Cart
      </button>
    </div>
  );
}
```

### Mini Cart Widget

```tsx
function MiniCart() {
  const { cart } = useCart();
  
  return (
    <div className="mini-cart">
      <span>🛒 {cart.items.reduce((sum, i) => sum + i.quantity, 0)}</span>
      <span>${(cart.total / 100).toFixed(2)}</span>
    </div>
  );
}
```

### Gated Content

```tsx
function GatedContent({ children, feature, fallback }) {
  const { hasAccess } = useStripeConvex();
  const [allowed, setAllowed] = useState(null);
  const user = useCurrentUser();

  useEffect(() => {
    if (user?.email) {
      hasAccess({ feature, email: user.email }).then(setAllowed);
    }
  }, [user, feature]);

  if (allowed === null) return <Loading />;
  if (!allowed) return fallback;
  return children;
}
```
