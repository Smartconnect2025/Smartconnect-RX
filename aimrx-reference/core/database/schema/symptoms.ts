import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, text, boolean } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Symptoms table for available symptoms
 * Master list of symptoms that can be tracked
 */
export const symptoms = pgTable(
  "symptoms",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    emoji: text("emoji"),
    is_common: boolean("is_common").default(false),
  },
  () => [
    // SELECT: All authenticated users can read (master list)
    pgPolicy("symptoms_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("symptoms_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("symptoms_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("symptoms_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Symptom = typeof symptoms.$inferSelect;
export type InsertSymptom = typeof symptoms.$inferInsert;
