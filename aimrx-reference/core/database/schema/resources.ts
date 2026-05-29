import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, uuid, timestamp, text } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Resources table for educational content, articles, videos, and other materials
 * Stores various types of resources that users can access
 */
export const resources = pgTable(
  "resources",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Resource content
    title: text("title").notNull(),
    description: text("description").notNull(),
    url: text("url"), // Link to the actual resource (nullable for text-based resources)
    content: text("content"), // Text content for resources without external URLs
    cover_src: text("cover_src"), // Cover image/thumbnail URL

    // Resource categorization
    type: text("type").notNull(), // e.g., "article", "video", "pdf", "link"
    tags: text("tags").array(), // Array of tags for filtering/searching

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
    pgPolicy("resources_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // INSERT: Admin only
    pgPolicy("resources_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("resources_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("resources_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;
export type UpdateResource = Partial<InsertResource>;
