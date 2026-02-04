import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx, GenericDataModel } from "convex/server";

/**
 * Get or create a customer by email
 */
export const getOrCreateCustomer = {
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
  },
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
 * Get customer by email
 */
export const getByEmail = {
  args: { email: v.string() },
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
 * Get customer by Stripe customer ID
 */
export const getByStripeId = {
  args: { stripeCustomerId: v.string() },
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
 * Update customer
 */
export const update = {
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
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
