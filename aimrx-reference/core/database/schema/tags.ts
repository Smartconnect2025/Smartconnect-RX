import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Tags table for resource categorization
 * Stores tags with usage count tracking for better management
 */
export const tags = pgTable(
  "tags",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Tag details
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(), // URL-friendly version of name

    // Usage tracking
    usage_count: integer("usage_count").notNull().default(0), // Number of resources using this tag

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: All authenticated users can read
    pgPolicy("tags_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("tags_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("tags_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("tags_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Tag = typeof tags.$inferSelect;
export type CreateTagData = typeof tags.$inferInsert;
