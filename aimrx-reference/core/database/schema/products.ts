import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  integer,
  serial,
  timestamp,
  text,
  varchar,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Categories table for product categorization
 * Stores product categories with display configuration and branding
 */
export const categories = pgTable(
  "categories",
  {
    // Primary key (serial for auto-increment integer)
    id: serial("id").primaryKey(),

    // Category details
    name: varchar("name", { length: 255 }).notNull().unique(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),

    // Display configuration
    display_order: integer("display_order").notNull().default(0),
    is_active: boolean("is_active").notNull().default(true),
    color: varchar("color", { length: 50 }), // Hex color or color name for branding
    image_url: text("image_url"), // Category image/icon

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: All authenticated users can read (public catalog)
    pgPolicy("categories_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("categories_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("categories_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("categories_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Products table for catalog items
 * Stores complete product information including pricing, prescription requirements, and inventory
 */
export const products = pgTable(
  "products",
  {
    // Primary key (serial for auto-increment integer)
    id: serial("id").primaryKey(),

    // Link to category
    category_id: integer("category_id")
      .references(() => categories.id)
      .notNull(),

    // Product details
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    image_url: text("image_url"),

    // Medical information
    active_ingredient: text("active_ingredient"),
    benefits: text("benefits"),
    safety_info: text("safety_info"),

    // Pricing (stored in cents for precision)
    subscription_price: integer("subscription_price").notNull(), // Regular subscription price
    subscription_price_discounted: integer("subscription_price_discounted"), // Discounted price

    // Inventory management (moved from separate table)
    stock_quantity: integer("stock_quantity").notNull().default(0),
    low_stock_threshold: integer("low_stock_threshold").notNull().default(10),

    // Product flags
    is_active: boolean("is_active").notNull().default(true),
    is_best_seller: boolean("is_best_seller").notNull().default(false),
    requires_prescription: boolean("requires_prescription")
      .notNull()
      .default(false),

    // Stripe integration
    stripe_product_id: text("stripe_product_id"),
    stripe_price_ids: jsonb("stripe_price_ids"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: All authenticated users can read (public catalog)
    pgPolicy("products_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("products_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("products_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("products_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type UpdateCategory = Partial<InsertCategory>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type UpdateProduct = Partial<InsertProduct>;
