import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";
import { orderStatusValidator, cartItemValidator } from "./schema.js";

/**
 * Create a new order
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
 * Update order with payment/subscription ID
 */
export const linkPayment = {
  args: {
    orderId: v.string(),
    paymentId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
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
 * Update order status
 */
export const updateStatus = {
  args: {
    orderId: v.string(),
    status: orderStatusValidator,
  },
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
 * Get orders by email
 */
export const getByEmail = {
  args: {
    email: v.string(),
    status: v.optional(orderStatusValidator),
  },
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
 * Get order by ID
 */
export const getById = {
  args: { orderId: v.string() },
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { orderId: string }
  ) => {
    const db = ctx.db as any;
    return await db.get(args.orderId as any);
  },
};
