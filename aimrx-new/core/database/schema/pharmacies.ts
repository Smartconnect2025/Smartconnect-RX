import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Pharmacies Table
 * Multi-pharmacy platform support
 */
export const pharmacies = pgTable(
  "pharmacies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo_url: text("logo_url"),
    primary_color: text("primary_color").default("#00AEEF"),
    tagline: text("tagline"),
    address: text("address"),
    npi: text("npi"),
    dea_number: text("dea_number"),
    ncpdp_number: text("ncpdp_number"),
    phone: text("phone"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  () => [
    // SELECT: All authenticated users can read (for pharmacy selection)
    pgPolicy("pharmacies_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("pharmacies_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("pharmacies_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("pharmacies_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Pharmacy = typeof pharmacies.$inferSelect;
export type NewPharmacy = typeof pharmacies.$inferInsert;
