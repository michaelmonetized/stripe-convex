"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type {
  AddToCartProps,
  CartItemTitleProps,
  CartItemPriceProps,
  CartItemDescriptionProps,
  CartItemButtonProps,
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
  handleAddToCart: () => void;
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
 */
export function AddToCart({ children, className }: AddToCartProps) {
  const { addToCart } = useStripeConvex();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);

  const handleAddToCart = useCallback(() => {
    if (!title || price <= 0) {
      console.error("AddToCart: title and price are required");
      return;
    }

    addToCart({
      title,
      description: description || undefined,
      price,
    });
  }, [addToCart, title, description, price]);

  return (
    <AddToCartContext.Provider
      value={{
        title,
        setTitle,
        description,
        setDescription,
        price,
        setPrice,
        handleAddToCart,
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
 * Button component - triggers add to cart
 */
export function CartItemButton({ children, onClick, className }: CartItemButtonProps) {
  const { handleAddToCart } = useAddToCartContext();

  const handleClick = () => {
    handleAddToCart();
    onClick?.();
  };

  return (
    <button onClick={handleClick} className={className} type="button">
      {children}
    </button>
  );
}
