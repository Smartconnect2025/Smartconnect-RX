import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  varchar,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { patients } from "./patients";
import { providers } from "./providers";
import { appointments } from "./appointments";
import { orders } from "./orders";

export const encounterStatusEnum = pgEnum("encounter_status", [
  "upcoming",
  "completed",
  "in_progress",
]);

export const encounterTypeEnum = pgEnum("encounter_type", [
  "routine",
  "follow_up",
  "urgent",
  "consultation",
]);

export const encounterBusinessTypeEnum = pgEnum("encounter_business_type", [
  "appointment_based",
  "order_based",
  "order_based_async",
  "order_based_sync",
  "coaching",
  "manual",
]);

/**
 * Encounters table for healthcare encounters/visits
 * Links patients with healthcare encounters and stores visit details
 */
export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),
    provider_id: uuid("provider_id").references(() => providers.id),
    finalized_by: uuid("finalized_by").references(() => authUsers.id),

    // Encounter details
    title: varchar("title", { length: 255 }).notNull(),
    encounter_date: timestamp("encounter_date", {
      withTimezone: true,
    }).notNull(),
    status: encounterStatusEnum("status").notNull().default("upcoming"),
    encounter_type: encounterTypeEnum("encounter_type")
      .notNull()
      .default("routine"),

    // Business type for workflow differentiation
    business_type: encounterBusinessTypeEnum("business_type").notNull(),

    // Appointment linkage
    appointment_id: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),

    // Order linkage (for order-based encounters)
    order_id: uuid("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),

    provider_name: varchar("provider_name", { length: 255 }),
    provider_notes: text("provider_notes"),
    finalized_at: timestamp("finalized_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own, provider sees assigned patients, admin sees all
    pgPolicy("encounters_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // INSERT: Provider for assigned patients, admin
    pgPolicy("encounters_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // UPDATE: Provider for assigned patients, admin
    pgPolicy("encounters_update_policy", {
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
    pgPolicy("encounters_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Encounter = typeof encounters.$inferSelect;
export type InsertEncounter = typeof encounters.$inferInsert;
export type UpdateEncounter = Partial<InsertEncounter>;

export type EncounterStatus = (typeof encounterStatusEnum.enumValues)[number];
export type EncounterType = (typeof encounterTypeEnum.enumValues)[number];
export type EncounterBusinessType =
  (typeof encounterBusinessTypeEnum.enumValues)[number];
