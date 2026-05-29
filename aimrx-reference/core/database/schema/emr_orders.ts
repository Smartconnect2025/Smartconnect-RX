import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { patients } from "./patients";
import { encounters } from "./encounters";

export const OrderTypeEnum = pgEnum("order_type", [
  "lab",
  "imaging",
  "medication",
  "referral",
]);

/**
 * EMR Orders table for medical orders
 * Stores lab orders, imaging orders, procedures, medications, and referrals
 * Note: Order status is now managed in the orders table
 */
export const emrOrders = pgTable(
  "emr_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),
    encounter_id: uuid("encounter_id")
      .references(() => encounters.id, { onDelete: "cascade" })
      .notNull(),
    ordered_by: uuid("ordered_by")
      .notNull()
      .references(() => authUsers.id),

    // Order details
    order_type: OrderTypeEnum("order_type").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    ordered_at: timestamp("ordered_at", { withTimezone: true }).defaultNow(),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own, provider sees assigned patients, admin sees all
    pgPolicy("emr_orders_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // INSERT: Provider for assigned patients, admin
    pgPolicy("emr_orders_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // UPDATE: Provider for assigned patients, admin
    pgPolicy("emr_orders_update_policy", {
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
    pgPolicy("emr_orders_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type EmrOrder = typeof emrOrders.$inferSelect;
export type InsertEmrOrder = typeof emrOrders.$inferInsert;
export type UpdateEmrOrder = Partial<InsertEmrOrder>;
