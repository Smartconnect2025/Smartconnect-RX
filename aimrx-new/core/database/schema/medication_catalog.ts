import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  varchar,
  text,
  numeric,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Medication Catalog table for pre-saved medications
 * Stores medication templates that doctors can search and use
 */
export const medicationCatalog = pgTable(
  "medication_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Medication details - matching prescription form fields
    medication_name: varchar("medication_name", { length: 255 }).notNull(),
    vial_size: varchar("vial_size", { length: 100 }),
    dosage_amount: varchar("dosage_amount", { length: 50 }),
    dosage_unit: varchar("dosage_unit", { length: 20 }),
    form: varchar("form", { length: 100 }),
    quantity: varchar("quantity", { length: 50 }),
    refills: varchar("refills", { length: 10 }),
    sig: text("sig"),
    pharmacy_notes: text("pharmacy_notes"),

    // Pricing fields
    patient_price: numeric("patient_price", { precision: 10, scale: 2 }),
    doctor_price: numeric("doctor_price", { precision: 10, scale: 2 }),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: All authenticated users can read (medication catalog)
    pgPolicy("medication_catalog_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("medication_catalog_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("medication_catalog_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("medication_catalog_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type MedicationCatalog = typeof medicationCatalog.$inferSelect;
export type InsertMedicationCatalog = typeof medicationCatalog.$inferInsert;
export type UpdateMedicationCatalog = Partial<InsertMedicationCatalog>;
