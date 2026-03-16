import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, uuid, timestamp, text } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { encounters } from "./encounters";

/**
 * Addendums table for encounter notes addendums
 * Stores additional notes added to finalized encounters
 */
export const addendums = pgTable(
  "addendums",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    encounter_id: uuid("encounter_id")
      .references(() => encounters.id, { onDelete: "cascade" })
      .notNull(),

    // Addendum details
    content: text("content").notNull(),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Via encounter patient access
    pgPolicy("addendums_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = ${table.encounter_id}
        AND (
          public.is_own_patient_record(e.patient_id)
          OR public.provider_has_patient_access(e.patient_id)
        )
      )
    `,
    }),
    // INSERT: Provider via encounter, admin
    pgPolicy("addendums_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = ${table.encounter_id}
        AND public.provider_has_patient_access(e.patient_id)
      )
    `,
    }),
    // UPDATE: Provider via encounter, admin
    pgPolicy("addendums_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = ${table.encounter_id}
        AND public.provider_has_patient_access(e.patient_id)
      )
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = ${table.encounter_id}
        AND public.provider_has_patient_access(e.patient_id)
      )
    `,
    }),
    // DELETE: Admin only
    pgPolicy("addendums_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Addendum = typeof addendums.$inferSelect;
export type InsertAddendum = typeof addendums.$inferInsert;
export type UpdateAddendum = Partial<InsertAddendum>;
