/**
 * @module stripe-convex/convex/customers
 * @description Customer management utilities
 */

import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";

/**
 * Gets or creates a customer by email address.
 * 
 * If a customer with the email exists, returns their ID.
 * If not, creates a new customer record.
 * Optionally updates the Stripe customer ID if provided.
 * 
 * @example
 * ```ts
 * const customerId = await customers.getOrCreateCustomer.handler(ctx, {
 *   email: "customer@example.com",
 *   name: "John Doe",
 *   stripeCustomerId: "cus_1234567890",
 * });
 * ```
 */
export const getOrCreateCustomer = {
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Customer details
   * @returns Customer document ID
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { email: string; name?: string; stripeCustomerId?: string }
  ) => {
    const db = ctx.db as any;
    const existing = await db
      .query("sc_customers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();

    if (existing) {
      // Update if new info provided
      if (args.stripeCustomerId && !existing.stripeCustomerId) {
        await db.patch(existing._id, {
          stripeCustomerId: args.stripeCustomerId,
          updatedAt: Date.now(),
        });
      }
      return existing._id;
    }

    const now = Date.now();
    return await db.insert("sc_customers", {
      email: args.email,
      name: args.name,
      stripeCustomerId: args.stripeCustomerId,
      createdAt: now,
      updatedAt: now,
    });
  },
};

/**
 * Gets a customer by email address.
 * 
 * @example
 * ```ts
 * const customer = await customers.getByEmail.handler(ctx, {
 *   email: "customer@example.com",
 * });
 * if (customer) {
 *   console.log(customer.stripeCustomerId);
 * }
 * ```
 */
export const getByEmail = {
  args: { email: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Email to look up
   * @returns Customer document or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { email: string }
  ) => {
    const db = ctx.db as any;
    return await db
      .query("sc_customers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();
  },
};

/**
 * Gets a customer by Stripe customer ID.
 * 
 * @example
 * ```ts
 * const customer = await customers.getByStripeId.handler(ctx, {
 *   stripeCustomerId: "cus_1234567890",
 * });
 * ```
 */
export const getByStripeId = {
  args: { stripeCustomerId: v.string() },
  /**
   * @param ctx - Convex query context
   * @param args - Stripe customer ID to look up
   * @returns Customer document or null if not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericQueryCtx<DataModel>,
    args: { stripeCustomerId: string }
  ) => {
    const db = ctx.db as any;
    return await db
      .query("sc_customers")
      .withIndex("by_stripe_customer", (q: any) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
  },
};

/**
 * Updates a customer record.
 * 
 * @example
 * ```ts
 * await customers.update.handler(ctx, {
 *   email: "customer@example.com",
 *   name: "Jane Doe",
 *   stripeCustomerId: "cus_9876543210",
 * });
 * ```
 */
export const update = {
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  /**
   * @param ctx - Convex mutation context
   * @param args - Customer updates
   * @returns Customer document ID
   * @throws Error if customer not found
   */
  handler: async <DataModel extends GenericDataModel>(
    ctx: GenericMutationCtx<DataModel>,
    args: { email: string; name?: string; stripeCustomerId?: string; metadata?: any }
  ) => {
    const db = ctx.db as any;
    const customer = await db
      .query("sc_customers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();

    if (!customer) {
      throw new Error(`Customer not found: ${args.email}`);
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.stripeCustomerId !== undefined) updates.stripeCustomerId = args.stripeCustomerId;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await db.patch(customer._id, updates);
    return customer._id;
  },
};
