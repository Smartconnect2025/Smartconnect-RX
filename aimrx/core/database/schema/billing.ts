import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  varchar,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { encounters } from "./encounters";

/**
 * Billing groups table for encounter billing
 * Groups procedures, diagnoses, and modifiers for billing purposes
 */
export const billingGroups = pgTable(
  "billing_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    encounter_id: uuid("encounter_id")
      .references(() => encounters.id, { onDelete: "cascade" })
      .notNull(),

    // Billing details
    procedure_code: varchar("procedure_code", { length: 10 }).notNull(),
    procedure_description: text("procedure_description").notNull(),
    modifiers: varchar("modifiers", { length: 50 }),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Provider via encounter, admin
    pgPolicy("billing_groups_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = ${table.encounter_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // INSERT: Provider via encounter, admin
    pgPolicy("billing_groups_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = ${table.encounter_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // UPDATE: Provider via encounter, admin
    pgPolicy("billing_groups_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = ${table.encounter_id}
        AND p.user_id = auth.uid()
      )
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = ${table.encounter_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // DELETE: Admin only
    pgPolicy("billing_groups_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Billing diagnoses table
 * Links diagnoses to billing groups for proper coding
 */
export const billingDiagnoses = pgTable(
  "billing_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    billing_group_id: uuid("billing_group_id")
      .references(() => billingGroups.id, { onDelete: "cascade" })
      .notNull(),

    // Diagnosis details
    icd_code: varchar("icd_code", { length: 20 }).notNull(),
    description: text("description").notNull(),
    is_primary: boolean("is_primary").notNull().default(false),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Via billing group access
    pgPolicy("billing_diagnoses_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // INSERT: Via billing group access
    pgPolicy("billing_diagnoses_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // UPDATE: Via billing group access
    pgPolicy("billing_diagnoses_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // DELETE: Admin only
    pgPolicy("billing_diagnoses_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Billing procedures table
 * Links procedures to billing groups for additional billing items
 */
export const billingProcedures = pgTable(
  "billing_procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    billing_group_id: uuid("billing_group_id")
      .references(() => billingGroups.id, { onDelete: "cascade" })
      .notNull(),

    // Procedure details
    cpt_code: varchar("cpt_code", { length: 10 }).notNull(),
    description: text("description").notNull(),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Via billing group access
    pgPolicy("billing_procedures_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // INSERT: Via billing group access
    pgPolicy("billing_procedures_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // UPDATE: Via billing group access
    pgPolicy("billing_procedures_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = ${table.billing_group_id}
        AND p.user_id = auth.uid()
      )
    `,
    }),
    // DELETE: Admin only
    pgPolicy("billing_procedures_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type BillingGroup = typeof billingGroups.$inferSelect;
export type InsertBillingGroup = typeof billingGroups.$inferInsert;
export type UpdateBillingGroup = Partial<InsertBillingGroup>;

export type BillingDiagnosis = typeof billingDiagnoses.$inferSelect;
export type InsertBillingDiagnosis = typeof billingDiagnoses.$inferInsert;
export type UpdateBillingDiagnosis = Partial<InsertBillingDiagnosis>;

export type BillingProcedure = typeof billingProcedures.$inferSelect;
export type InsertBillingProcedure = typeof billingProcedures.$inferInsert;
export type UpdateBillingProcedure = Partial<InsertBillingProcedure>;
