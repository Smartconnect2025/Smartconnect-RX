import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { patients } from "./patients";
import { encounters } from "./encounters";

/**
 * Allergies table for patient allergies and sensitivities
 * Stores allergy information including allergen, reaction, and severity
 */
export const allergies = pgTable(
  "allergies",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),
    encounter_id: uuid("encounter_id").references(() => encounters.id, {
      onDelete: "set null",
    }),

    // Allergy details
    is_allergic: boolean("is_allergic").notNull().default(true),
    allergen: varchar("allergen", { length: 255 }).notNull(),
    reaction_type: varchar("reaction_type", { length: 255 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("mild"),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own, provider sees assigned patients, admin sees all
    pgPolicy("allergies_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // INSERT: Provider for assigned patients, admin
    pgPolicy("allergies_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // UPDATE: Provider for assigned patients, admin
    pgPolicy("allergies_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // DELETE: Admin only
    pgPolicy("allergies_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Allergy = typeof allergies.$inferSelect;
export type InsertAllergy = typeof allergies.$inferInsert;
export type UpdateAllergy = Partial<InsertAllergy>;

export type AllergySeverity = "mild" | "moderate" | "severe";
