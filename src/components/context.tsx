"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type {
  StripeConvexConfig,
  StripeConvexContextValue,
  Cart,
  CartItem,
  AppliedCoupon,
} from "../types/index.js";
import { validateCoupon, calculateDiscount } from "../convex/coupons.js";

const StripeConvexContext = createContext<StripeConvexContextValue | null>(null);

export interface StripeConvexProviderProps {
  config: StripeConvexConfig;
  children: React.ReactNode;
  /** Function to call Convex checkout action */
  onCheckout?: (cart: Cart) => Promise<{ url: string } | null>;
  /** Function to check access via Convex query */
  onCheckAccess?: (params: { feature?: string; plan?: string; email: string }) => Promise<boolean>;
  /** Function to get coupon usage counts from Convex */
  onGetCouponUsage?: (code: string, email: string) => Promise<{ total: number; email: number }>;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function StripeConvexProvider({
  config,
  children,
  onCheckout,
  onCheckAccess,
  onGetCouponUsage,
}: StripeConvexProviderProps) {
  const [cart, setCart] = useState<Cart>({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
  });

  const recalculateCart = useCallback(
    (items: CartItem[], appliedCoupon?: AppliedCoupon): Cart => {
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      let discount = 0;
      let coupon = appliedCoupon;

      if (coupon) {
        // Recalculate discount with new subtotal
        const couponRule = config.coupons?.find((c) => c.code === coupon!.code);
        if (couponRule) {
          discount = calculateDiscount(couponRule, subtotal);
          coupon = { ...coupon, discountAmount: discount };
        }
      }

      return {
        items,
        subtotal,
        discount,
        total: Math.max(0, subtotal - discount),
        appliedCoupon: coupon,
        email: cart.email,
      };
    },
    [config.coupons, cart.email]
  );

  const addToCart = useCallback(
    (item: Omit<CartItem, "id" | "quantity">) => {
      setCart((prev) => {
        // Check if item already exists (same title and price)
        const existingIndex = prev.items.findIndex(
          (i) => i.title === item.title && i.price === item.price
        );

        let newItems: CartItem[];
        if (existingIndex >= 0) {
          newItems = prev.items.map((i, idx) =>
            idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i
          );
        } else {
          newItems = [...prev.items, { ...item, id: generateId(), quantity: 1 }];
        }

        return recalculateCart(newItems, prev.appliedCoupon);
      });
    },
    [recalculateCart]
  );

  const removeFromCart = useCallback(
    (itemId: string) => {
      setCart((prev) => {
        const newItems = prev.items.filter((i) => i.id !== itemId);
        return recalculateCart(newItems, prev.appliedCoupon);
      });
    },
    [recalculateCart]
  );

  const updateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      setCart((prev) => {
        if (quantity <= 0) {
          const newItems = prev.items.filter((i) => i.id !== itemId);
          return recalculateCart(newItems, prev.appliedCoupon);
        }

        const newItems = prev.items.map((i) =>
          i.id === itemId ? { ...i, quantity } : i
        );
        return recalculateCart(newItems, prev.appliedCoupon);
      });
    },
    [recalculateCart]
  );

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      email: cart.email,
    });
  }, [cart.email]);

  const applyCoupon = useCallback(
    async (code: string): Promise<AppliedCoupon | null> => {
      const couponRule = config.coupons?.find(
        (c) => c.code.toLowerCase() === code.toLowerCase()
      );

      if (!couponRule) {
        return null;
      }

      const email = cart.email || "";
      const hasSubscriptionItem = cart.items.some((i) => i.isSubscription);

      // Get usage counts if available
      let currentUsage = 0;
      let emailUsage = 0;
      if (onGetCouponUsage) {
        const usage = await onGetCouponUsage(couponRule.code, email);
        currentUsage = usage.total;
        emailUsage = usage.email;
      }

      const validation = validateCoupon(couponRule, {
        email,
        orderAmount: cart.subtotal,
        isSubscription: hasSubscriptionItem,
        planId: cart.items[0]?.planId,
        currentUsage,
        emailUsage,
      });

      if (!validation.valid) {
        console.error("Coupon validation failed:", validation.error);
        return null;
      }

      const discountAmount = calculateDiscount(couponRule, cart.subtotal);
      const appliedCoupon: AppliedCoupon = {
        code: couponRule.code,
        discountType: couponRule.discountType,
        discountValue: couponRule.discountValue,
        discountAmount,
        description: couponRule.description,
      };

      setCart((prev) => recalculateCart(prev.items, appliedCoupon));
      return appliedCoupon;
    },
    [config.coupons, cart.email, cart.subtotal, cart.items, onGetCouponUsage, recalculateCart]
  );

  const removeCoupon = useCallback(() => {
    setCart((prev) => recalculateCart(prev.items, undefined));
  }, [recalculateCart]);

  const setEmail = useCallback((email: string) => {
    setCart((prev) => ({ ...prev, email }));
  }, []);

  const checkout = useCallback(async (): Promise<{ url: string } | null> => {
    if (!onCheckout) {
      console.error("No checkout handler provided");
      return null;
    }

    if (cart.items.length === 0) {
      console.error("Cart is empty");
      return null;
    }

    if (!cart.email) {
      console.error("Email is required for checkout");
      return null;
    }

    return await onCheckout(cart);
  }, [onCheckout, cart]);

  const hasAccess = useCallback(
    async (params: { feature?: string; plan?: string; email: string }): Promise<boolean> => {
      if (!onCheckAccess) {
        console.warn("No access check handler provided");
        return false;
      }
      return await onCheckAccess(params);
    },
    [onCheckAccess]
  );

  const value = useMemo<StripeConvexContextValue>(
    () => ({
      config,
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      applyCoupon,
      removeCoupon,
      setEmail,
      checkout,
      hasAccess,
    }),
    [
      config,
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      applyCoupon,
      removeCoupon,
      setEmail,
      checkout,
      hasAccess,
    ]
  );

  return (
    <StripeConvexContext.Provider value={value}>
      {children}
    </StripeConvexContext.Provider>
  );
}

export function useStripeConvex(): StripeConvexContextValue {
  const context = useContext(StripeConvexContext);
  if (!context) {
    throw new Error("useStripeConvex must be used within a StripeConvexProvider");
  }
  return context;
}

export function useCart() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useStripeConvex();
  return { cart, addToCart, removeFromCart, updateQuantity, clearCart };
}

export function useCoupon() {
  const { cart, applyCoupon, removeCoupon } = useStripeConvex();
  return { appliedCoupon: cart.appliedCoupon, applyCoupon, removeCoupon };
}

export function useCheckout() {
  const { cart, setEmail, checkout } = useStripeConvex();
  return { cart, setEmail, checkout };
}
