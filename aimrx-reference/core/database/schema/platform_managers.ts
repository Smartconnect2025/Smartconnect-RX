import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Platform Managers table
 * Stores platform manager names that can be assigned to groups
 */
export const platform_managers = pgTable(
  "platform_managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Platform Manager Information
    name: text("name").notNull(),
    email: text("email"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: Admins and providers can read
    pgPolicy("platform_managers_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid()) OR public.is_provider()`,
    }),
    // INSERT: Admin only
    pgPolicy("platform_managers_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("platform_managers_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("platform_managers_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type PlatformManager = typeof platform_managers.$inferSelect;
export type InsertPlatformManager = typeof platform_managers.$inferInsert;
export type UpdatePlatformManager = Partial<InsertPlatformManager>;
