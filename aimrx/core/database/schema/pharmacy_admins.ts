import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { pharmacies } from "./pharmacies";

/**
 * Pharmacy Admins
 * Tracks which users have admin access to which pharmacies
 */
export const pharmacy_admins = pgTable(
  "pharmacy_admins",
  {
    user_id: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    pharmacy_id: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.user_id, table.pharmacy_id] }),
    // SELECT: User sees own records, admin sees all
    pgPolicy("pharmacy_admins_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR ${table.user_id} = auth.uid()
      `,
    }),
    // INSERT: Admin only
    pgPolicy("pharmacy_admins_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("pharmacy_admins_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("pharmacy_admins_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type PharmacyAdmin = typeof pharmacy_admins.$inferSelect;
export type NewPharmacyAdmin = typeof pharmacy_admins.$inferInsert;
