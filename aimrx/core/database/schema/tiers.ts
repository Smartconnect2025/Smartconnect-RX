import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  decimal,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Tiers table for managing provider discount tiers
 * Stores tier information including name and discount percentage
 */
export const tiers = pgTable(
  "tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tier Information
    tier_name: text("tier_name").notNull().unique(), // e.g., "Tier 1", "Tier 2", "Tier 3"
    tier_code: text("tier_code").notNull().unique(), // e.g., "tier1", "tier2", "tier3"
    discount_percentage: decimal("discount_percentage", {
      precision: 5,
      scale: 2,
    }).notNull(), // e.g., 10.00, 15.50, 20.00
    description: text("description"), // Optional description of the tier

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: All authenticated users can read
    pgPolicy("tiers_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("tiers_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("tiers_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("tiers_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Tier = typeof tiers.$inferSelect;
export type NewTier = typeof tiers.$inferInsert;
