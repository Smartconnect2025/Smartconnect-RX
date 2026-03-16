import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  varchar,
  integer,
  decimal,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { patients } from "./patients";
import { encounters } from "./encounters";

/**
 * Vitals table for patient vital signs
 * Stores vital measurements taken during encounters
 */
export const vitals = pgTable(
  "vitals",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),
    encounter_id: uuid("encounter_id")
      .references(() => encounters.id, { onDelete: "cascade" })
      .notNull(),

    // Vital measurements
    blood_pressure: varchar("blood_pressure", { length: 20 }),
    heart_rate: integer("heart_rate"),
    weight: decimal("weight", { precision: 5, scale: 2 }),
    height: varchar("height", { length: 20 }),
    temperature: decimal("temperature", { precision: 4, scale: 1 }),
    blood_oxygen: integer("blood_oxygen"),
    bmi: decimal("bmi", { precision: 4, scale: 1 }),
    respiratory_rate: integer("respiratory_rate"),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own, provider sees assigned patients, admin sees all
    pgPolicy("vitals_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // INSERT: Provider for assigned patients, admin
    pgPolicy("vitals_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // UPDATE: Provider for assigned patients, admin
    pgPolicy("vitals_update_policy", {
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
    pgPolicy("vitals_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Vitals = typeof vitals.$inferSelect;
export type InsertVitals = typeof vitals.$inferInsert;
export type UpdateVitals = Partial<InsertVitals>;
