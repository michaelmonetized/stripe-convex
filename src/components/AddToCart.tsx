"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type {
  AddToCartProps,
  CartItemTitleProps,
  CartItemPriceProps,
  CartItemDescriptionProps,
  CartItemButtonProps,
  CartItemPlanProps,
} from "../types/index.js";
import { useStripeConvex } from "./context.js";

// Internal context for AddToCart compound component
interface AddToCartContextValue {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  price: number;
  setPrice: (price: number) => void;
  isSubscription: boolean;
  planId?: string;
  interval?: "month" | "year" | "week" | "day";
  setInterval: (interval: "month" | "year" | "week" | "day" | undefined) => void;
  handleAddToCart: () => void;
  handleCheckout: () => void;
}

const AddToCartContext = createContext<AddToCartContextValue | null>(null);

function useAddToCartContext() {
  const context = useContext(AddToCartContext);
  if (!context) {
    throw new Error("AddToCart components must be used within <AddToCart>");
  }
  return context;
}

/**
 * AddToCart compound component
 * Usage:
 * <AddToCart>
 *   <CartItemTitle>Product Name</CartItemTitle>
 *   <CartItemPrice price={1999} />
 *   <CartItemDescription>Product description</CartItemDescription>
 *   <CartItemButton>Add to Cart</CartItemButton>
 * </AddToCart>
 * 
 * For subscriptions:
 * <AddToCart isSubscription planId="pro">
 *   <CartItemTitle>Pro Plan</CartItemTitle>
 *   <CartItemPrice price={999} />
 *   <CartItemPlan interval="month" />
 *   <CartItemButton>Start with Pro Plan</CartItemButton>
 * </AddToCart>
 */
export function AddToCart({ children, className, isSubscription = false, planId }: AddToCartProps) {
  const { addToCart, clearCart, checkout, setEmail } = useStripeConvex();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [interval, setInterval] = useState<"month" | "year" | "week" | "day" | undefined>(undefined);

  const handleAddToCart = useCallback(() => {
    if (!title || price <= 0) {
      console.error("AddToCart: title and price are required");
      return;
    }

    addToCart({
      title,
      description: description || undefined,
      price,
      isSubscription,
      planId,
    });
  }, [addToCart, title, description, price, isSubscription, planId]);

  const handleCheckout = useCallback(async () => {
    if (!title || price <= 0) {
      console.error("AddToCart: title and price are required for checkout");
      return;
    }

    // For subscription direct checkout, clear cart first and add this item
    clearCart();
    addToCart({
      title,
      description: description || undefined,
      price,
      isSubscription,
      planId,
    });

    // Trigger checkout
    const result = await checkout();
    if (result?.url) {
      window.location.href = result.url;
    }
  }, [addToCart, clearCart, checkout, title, description, price, isSubscription, planId]);

  return (
    <AddToCartContext.Provider
      value={{
        title,
        setTitle,
        description,
        setDescription,
        price,
        setPrice,
        isSubscription,
        planId,
        interval,
        setInterval,
        handleAddToCart,
        handleCheckout,
      }}
    >
      <div className={className}>{children}</div>
    </AddToCartContext.Provider>
  );
}

/**
 * Title component - sets the item title
 */
export function CartItemTitle({ children, className }: CartItemTitleProps) {
  const { setTitle } = useAddToCartContext();

  // Extract text content from children
  useEffect(() => {
    const text = typeof children === "string" ? children : "";
    setTitle(text);
  }, [children, setTitle]);

  return <div className={className}>{children}</div>;
}

/**
 * Price component - sets the item price
 */
export function CartItemPrice({ price, className }: CartItemPriceProps) {
  const { setPrice } = useAddToCartContext();

  useEffect(() => {
    setPrice(price);
  }, [price, setPrice]);

  // Format price for display
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price / 100);

  return <span className={className}>{formattedPrice}</span>;
}

/**
 * Description component - sets the item description
 */
export function CartItemDescription({ children, className }: CartItemDescriptionProps) {
  const { setDescription } = useAddToCartContext();

  useEffect(() => {
    const text = typeof children === "string" ? children : "";
    setDescription(text);
  }, [children, setDescription]);

  return <p className={className}>{children}</p>;
}

/**
 * Button component - triggers add to cart or direct checkout
 * For subscriptions, defaults to direct checkout behavior unless addToCart prop is true
 */
export function CartItemButton({ 
  children, 
  onClick, 
  className,
  addToCart: forceAddToCart = false,
}: CartItemButtonProps & { addToCart?: boolean }) {
  const { handleAddToCart, handleCheckout, isSubscription } = useAddToCartContext();

  const handleClick = async () => {
    // For subscriptions without forceAddToCart, go directly to checkout
    if (isSubscription && !forceAddToCart) {
      await handleCheckout();
    } else {
      handleAddToCart();
    }
    onClick?.();
  };

  return (
    <button onClick={handleClick} className={className} type="button">
      {children}
    </button>
  );
}

/**
 * Plan component - displays subscription plan details
 * Shows billing interval (e.g., "/month", "/year")
 */
export function CartItemPlan({ interval, children, className }: CartItemPlanProps) {
  const { setInterval } = useAddToCartContext();

  useEffect(() => {
    if (interval) {
      setInterval(interval);
    }
  }, [interval, setInterval]);

  // Format interval for display
  const intervalText = interval ? `/${interval}` : "";

  return (
    <span className={className}>
      {children || intervalText}
    </span>
  );
}
