import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";
import { patients } from "./patients";

/**
 * Provider-Patient Mappings table for many-to-many relationships
 * Stores the relationships between providers and their assigned patients
 */
export const providerPatientMappings = pgTable(
  "provider_patient_mappings",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    provider_id: uuid("provider_id")
      .references(() => providers.id, { onDelete: "cascade" })
      .notNull(),
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint to prevent duplicate mappings
    unique("provider_patient_unique").on(table.provider_id, table.patient_id),
    // Indexes for better query performance
    index("idx_provider_patient_mappings_provider_id").on(table.provider_id),
    index("idx_provider_patient_mappings_patient_id").on(table.patient_id),
    // SELECT: Provider sees own mappings, patient sees own mappings, admin sees all
    pgPolicy("ppm_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_own_provider_record(${table.provider_id})
        OR public.is_own_patient_record(${table.patient_id})
      `,
    }),
    // INSERT: Provider can create mappings, admin can create
    pgPolicy("ppm_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        public.is_admin(auth.uid())
        OR public.is_own_provider_record(${table.provider_id})
      `,
    }),
    // UPDATE: Admin only
    pgPolicy("ppm_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("ppm_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type ProviderPatientMapping =
  typeof providerPatientMappings.$inferSelect;
export type InsertProviderPatientMapping =
  typeof providerPatientMappings.$inferInsert;
export type UpdateProviderPatientMapping =
  Partial<InsertProviderPatientMapping>;
