import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { userAddresses } from "./user_addresses";
import { products } from "./products";

export const OrderStatusEnum = pgEnum("order_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "completed",
  "active",
  "payment_failed",
]);

/**
 * Orders table for customer orders and transactions
 * Stores order information with address and payment details
 */
export const orders = pgTable(
  "orders",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to auth user
    user_id: uuid("user_id")
      .references(() => authUsers.id, { onDelete: "cascade" })
      .notNull(),

    // Order status for provider review
    status: OrderStatusEnum("status").notNull().default("pending"),

    // Address information
    shipping_address_id: uuid("shipping_address_id")
      .references(() => userAddresses.id)
      .notNull(),
    billing_address_id: uuid("billing_address_id").references(
      () => userAddresses.id,
    ), // Nullable - can be same as shipping

    // Payment information
    payment_details: jsonb("payment_details"), // Credit card details, payment method, etc.

    // Stripe integration fields
    stripe_session_id: text("stripe_session_id"),
    stripe_subscription_id: text("stripe_subscription_id"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Own orders or admin
    pgPolicy("orders_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // INSERT: Own orders only
    pgPolicy("orders_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.user_id} = auth.uid()`,
    }),
    // UPDATE: Own orders or admin
    pgPolicy("orders_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
      withCheck: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // DELETE: Own orders or admin
    pgPolicy("orders_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Order line items table for individual products within orders
 * Stores product details and pricing information for each order item
 */
export const orderLineItems = pgTable(
  "order_line_items",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to order
    order_id: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),

    // Product information
    product_id: integer("product_id")
      .references(() => products.id)
      .notNull(), // Reference to products table
    name: text("name").notNull(), // Product name snapshot
    image_url: text("image_url"), // Product image URL

    // Quantity
    quantity: integer("quantity").notNull().default(1),

    // Pricing (stored in cents for precision)
    price: integer("price").notNull(), // One-time price in cents
    subscription_price: integer("subscription_price").notNull(), // Recurring price in cents

    // Stripe integration
    stripe_price_id: text("stripe_price_id"), // Stripe price ID used for this line item
  },
  (table) => [
    // SELECT: Via order ownership
    pgPolicy("order_line_items_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = ${table.order_id}
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
    }),
    // INSERT: Via order ownership
    pgPolicy("order_line_items_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = ${table.order_id}
        AND o.user_id = auth.uid()
      )
    `,
    }),
    // UPDATE: Via order ownership or admin
    pgPolicy("order_line_items_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = ${table.order_id}
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
      withCheck: sql`
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = ${table.order_id}
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
    }),
    // DELETE: Admin only
    pgPolicy("order_line_items_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Order activities table for tracking order status changes and history
 * Stores the timeline of order status updates and events
 */
export const orderActivities = pgTable(
  "order_activities",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to order
    order_id: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),

    // Activity details
    status: text("status").notNull(), // e.g., "Order Placed", "Provider Approved", "Shipped"
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // SELECT: Via order ownership
    pgPolicy("order_activities_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = ${table.order_id}
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
    }),
    // INSERT: Admin only (system creates activities)
    pgPolicy("order_activities_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("order_activities_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("order_activities_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type UpdateOrder = Partial<InsertOrder>;

export type OrderLineItem = typeof orderLineItems.$inferSelect;
export type InsertOrderLineItem = typeof orderLineItems.$inferInsert;
export type UpdateOrderLineItem = Partial<InsertOrderLineItem>;

export type OrderActivity = typeof orderActivities.$inferSelect;
export type InsertOrderActivity = typeof orderActivities.$inferInsert;
export type UpdateOrderActivity = Partial<InsertOrderActivity>;
