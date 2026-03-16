import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { pharmacies } from "./pharmacies";

/**
 * Pharmacy Medications Catalog
 * Medications available at each pharmacy with pricing
 */
export const pharmacy_medications = pgTable(
  "pharmacy_medications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacy_id: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    strength: text("strength"),
    form: text("form"),
    ndc: text("ndc"),
    vial_size: text("vial_size"), // Vial size / Quantity (e.g., "5mL", "30 tablets")
    retail_price_cents: integer("retail_price_cents").notNull(), // Pricing to AIMRx (from pharmacy)
    aimrx_site_pricing_cents: integer("aimrx_site_pricing_cents"), // AIMRx site pricing (what AIMRx charges)

    category: text("category").default("Standard Formulations"), // Weight Loss (GLP-1), Peptides, Sexual Health, etc.
    dosage_instructions: text("dosage_instructions"), // How to take the medication
    detailed_description: text("detailed_description"), // Detailed product description
    image_url: text("image_url"),
    is_active: boolean("is_active").default(true),
    in_stock: boolean("in_stock").default(true), // Track stock availability
    preparation_time_days: integer("preparation_time_days").default(0), // Days needed to prepare (for compounded medications)
    notes: text("notes"), // Special notes, out of stock reasons, preparation details, etc.
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // SELECT: Providers (for prescribing), pharmacy admin for their pharmacy, admin
    pgPolicy("pharmacy_medications_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_provider()
      OR public.is_pharmacy_admin(${table.pharmacy_id})
    `,
    }),
    // INSERT: Pharmacy admin for their pharmacy, admin
    pgPolicy("pharmacy_medications_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.is_pharmacy_admin(${table.pharmacy_id})
    `,
    }),
    // UPDATE: Pharmacy admin for their pharmacy, admin
    pgPolicy("pharmacy_medications_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_pharmacy_admin(${table.pharmacy_id})
    `,
    }),
    // DELETE: Pharmacy admin for their pharmacy, admin
    pgPolicy("pharmacy_medications_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_pharmacy_admin(${table.pharmacy_id})
    `,
    }),
  ],
);

export type PharmacyMedication = typeof pharmacy_medications.$inferSelect;
export type NewPharmacyMedication = typeof pharmacy_medications.$inferInsert;
