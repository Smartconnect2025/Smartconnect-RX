import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  varchar,
  date,
  text,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { patients } from "./patients";
import { encounters } from "./encounters";

/**
 * Conditions table for patient medical conditions
 * Stores chronic conditions, diagnoses, and medical problems
 */
export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),
    encounter_id: uuid("encounter_id").references(() => encounters.id, {
      onDelete: "set null",
    }),

    // Condition details
    name: varchar("name", { length: 255 }).notNull(),
    onset_date: date("onset_date").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    severity: varchar("severity", { length: 20 }).notNull().default("mild"),
    notes: text("notes"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own, provider sees assigned patients, admin sees all
    pgPolicy("conditions_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // INSERT: Provider for assigned patients, admin
    pgPolicy("conditions_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // UPDATE: Provider for assigned patients, admin
    pgPolicy("conditions_update_policy", {
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
    pgPolicy("conditions_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Condition = typeof conditions.$inferSelect;
export type InsertCondition = typeof conditions.$inferInsert;
export type UpdateCondition = Partial<InsertCondition>;

export type ConditionStatus = "active" | "resolved";
export type ConditionSeverity = "mild" | "moderate" | "severe";
