import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { platform_managers } from "./platform_managers";

/**
 * Groups table for organizing providers into groups
 * Each group has a name and an optional platform manager reference
 */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Group Information
    name: text("name").notNull(),

    // Platform Manager assignment
    platform_manager_id: uuid("platform_manager_id").references(
      () => platform_managers.id,
      { onDelete: "set null" },
    ),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: Admins and providers only
    pgPolicy("groups_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid()) OR public.is_provider()`,
    }),
    // INSERT: Admin only
    pgPolicy("groups_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("groups_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("groups_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;
export type UpdateGroup = Partial<InsertGroup>;
