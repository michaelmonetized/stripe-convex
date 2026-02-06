/**
 * Example React Provider setup for stripe-convex
 * 
 * This shows how to integrate stripe-convex with your React app.
 * File: app/providers.tsx (Next.js) or src/providers.tsx (Vite/CRA)
 */

"use client";

import { ReactNode, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { StripeConvexProvider } from "stripe-convex";
import { config } from "../lib/payment-config";

interface PaymentProviderProps {
  children: ReactNode;
  /** Current user's email (from your auth system) */
  userEmail?: string;
}

/**
 * Payment provider that connects stripe-convex to your Convex backend
 */
export function PaymentProvider({ children, userEmail }: PaymentProviderProps) {
  // Convex mutations and actions
  const checkoutAction = useAction(api.stripe.checkout);
  const checkAccessQuery = useQuery(api.stripe.checkAccess);

  // Checkout handler
  const handleCheckout = useCallback(
    async (cart: any) => {
      if (!cart.email) {
        throw new Error("Email is required for checkout");
      }

      const result = await checkoutAction({
        email: cart.email,
        items: cart.items.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          price: item.price,
          quantity: item.quantity,
          planId: item.planId,
          isSubscription: item.isSubscription,
        })),
        couponCode: cart.appliedCoupon?.code,
        discountAmount: cart.appliedCoupon?.discountAmount,
      });

      return result;
    },
    [checkoutAction]
  );

  // Access check handler
  const handleCheckAccess = useCallback(
    async (params: { feature?: string; plan?: string; email: string }) => {
      // Note: In a real app, you'd use a query with proper args
      // This is a simplified example
      const result = await checkAccessQuery;
      return result?.hasAccess ?? false;
    },
    [checkAccessQuery]
  );

  // Coupon usage handler (optional - for coupon validation)
  const handleGetCouponUsage = useCallback(
    async (code: string, email: string) => {
      // You would implement this to call your Convex query
      // For now, return zeros (allows all coupons)
      return { total: 0, email: 0 };
    },
    []
  );

  return (
    <StripeConvexProvider
      config={config}
      onCheckout={handleCheckout}
      onCheckAccess={handleCheckAccess}
      onGetCouponUsage={handleGetCouponUsage}
    >
      {children}
    </StripeConvexProvider>
  );
}

/**
 * Example: Combining with Convex and Clerk providers
 */
// import { ConvexProviderWithClerk } from "convex/react-clerk";
// import { ClerkProvider, useAuth } from "@clerk/nextjs";
// 
// export function Providers({ children }: { children: ReactNode }) {
//   return (
//     <ClerkProvider>
//       <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
//         <PaymentProvider>
//           {children}
//         </PaymentProvider>
//       </ConvexProviderWithClerk>
//     </ClerkProvider>
//   );
// }
