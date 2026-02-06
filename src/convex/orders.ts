/**
 * @module stripe-convex/convex/orders
 * @description Order record management utilities
 */

import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import { orderStatusValidator, cartItemValidator } from "./schema.js";

/**
 * Creates a new order from cart items.
 * Call this when initiating checkout to track the order.
 * 
 * @example
 * ```ts
 * const orderId = await orders.create.handler(ctx, {
 *   email: "customer@example.com",
 *   items: [
 *     { id: "1", title: "Pro Plan", price: 1999, quantity: 1, isSubscription: true },
 *   ],
 *   subtotal: 1999,
 *   discount: 0,
 *   total: 1999,
 * });
 * ```
 */
export const create = {
  args: {
    email: v.string(),
    items: v.array(cartItemValidator),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    couponCode: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Order details
   * @returns Order document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: {
      email: string;
      items: any[];
      subtotal: number;
      discount: number;
      total: number;
      couponCode?: string;
      metadata?: any;
    }
  ) => {
    const db = ctx.db as any;
    const now = Date.now();

    return await db.insert("sc_orders", {
      email: args.email,
      items: args.items,
      subtotal: args.subtotal,
      discount: args.discount,
      total: args.total,
      couponCode: args.couponCode,
      status: "pending",
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
};

/**
 * Links an order to a payment or subscription.
 * Call this after payment is processed to associate records.
 * 
 * @example
 * ```ts
 * // Link to payment
 * await orders.linkPayment.handler(ctx, {
 *   orderId: "abc123",
 *   paymentId: "def456",
 * });
 * 
 * // Link to subscription
 * await orders.linkPayment.handler(ctx, {
 *   orderId: "abc123",
 *   subscriptionId: "ghi789",
 * });
 * ```
 */
export const linkPayment = {
  args: {
    orderId: v.string(),
    paymentId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Order ID and payment/subscription ID
   * @returns Order document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { orderId: string; paymentId?: string; subscriptionId?: string }
  ) => {
    const db = ctx.db as any;
    const updates: any = { updatedAt: Date.now() };
    if (args.paymentId) updates.paymentId = args.paymentId;
    if (args.subscriptionId) updates.subscriptionId = args.subscriptionId;

    await db.patch(args.orderId as any, updates);
    return args.orderId;
  },
};

/**
 * Updates the status of an order.
 * 
 * @example
 * ```ts
 * // Mark as completed
 * await orders.updateStatus.handler(ctx, {
 *   orderId: "abc123",
 *   status: "completed",
 * });
 * 
 * // Mark as refunded
 * await orders.updateStatus.handler(ctx, {
 *   orderId: "abc123",
 *   status: "refunded",
 * });
 * ```
 */
export const updateStatus = {
  args: {
    orderId: v.string(),
    status: orderStatusValidator,
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Order ID and new status
   * @returns Order document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { orderId: string; status: string }
  ) => {
    const db = ctx.db as any;
    await db.patch(args.orderId as any, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return args.orderId;
  },
};

/**
 * Gets all orders for an email address.
 * Optionally filter by order status.
 * 
 * @example
 * ```ts
 * // Get all orders
 * const allOrders = await orders.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 * });
 * 
 * // Get only completed orders
 * const completedOrders = await orders.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 *   status: "completed",
 * });
 * ```
 */
export const getByEmail = {
  args: {
    email: v.string(),
    status: v.optional(orderStatusValidator),
  },
  /**
   * @param ctx - Convex query context
   * @param args - Email and optional status filter
   * @returns Array of order documents
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string; status?: string }
  ) => {
    const db = ctx.db as any;
    const orders = await db
      .query("sc_orders")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    if (args.status) {
      return orders.filter((o: any) => o.status === args.status);
    }
    return orders;
  },
};

/**
 * Gets an order by ID.
 * 
 * @example
 * ```ts
 * const order = await orders.getById.handler(ctx, {
 *   orderId: "abc123",
 * });
 * if (order) {
 *   console.log(order.items, order.total);
 * }
 * ```
 */
export const getById = {
  args: { orderId: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Order document ID
   * @returns Order document or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { orderId: string }
  ) => {
    const db = ctx.db as any;
    return await db.get(args.orderId as any);
  },
};
