import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const api_health_snapshots = pgTable(
  "api_health_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    check_key: text("check_key").notNull().unique(),
    pharmacy_id: uuid("pharmacy_id"),
    backend_id: uuid("backend_id"),
    service_name: text("service_name").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("unknown"),
    severity: text("severity").notNull().default("info"),
    response_time_ms: integer("response_time_ms"),
    consecutive_failures: integer("consecutive_failures").notNull().default(0),
    last_error: text("last_error"),
    checked_at: timestamp("checked_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  () => [
    pgPolicy("api_health_snapshots_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("api_health_snapshots_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("api_health_snapshots_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("api_health_snapshots_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type ApiHealthSnapshot = typeof api_health_snapshots.$inferSelect;
export type NewApiHealthSnapshot = typeof api_health_snapshots.$inferInsert;
