import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { pharmacies } from "./pharmacies";

/**
 * Provider-Pharmacy Links
 * Tracks which pharmacies each provider can prescribe to
 */
export const provider_pharmacy_links = pgTable(
  "provider_pharmacy_links",
  {
    provider_id: uuid("provider_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    pharmacy_id: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id, { onDelete: "cascade" }),
    custom_markup_percent: integer("custom_markup_percent"),
  },
  (table) => [
    primaryKey({ columns: [table.provider_id, table.pharmacy_id] }),
    // SELECT: Provider sees own, pharmacy admin sees their pharmacy's links, admin sees all
    pgPolicy("provider_pharmacy_links_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR ${table.provider_id} = auth.uid()
        OR public.is_pharmacy_admin(${table.pharmacy_id})
      `,
    }),
    // INSERT: Admin only
    pgPolicy("provider_pharmacy_links_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("provider_pharmacy_links_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("provider_pharmacy_links_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type ProviderPharmacyLink = typeof provider_pharmacy_links.$inferSelect;
export type NewProviderPharmacyLink =
  typeof provider_pharmacy_links.$inferInsert;
