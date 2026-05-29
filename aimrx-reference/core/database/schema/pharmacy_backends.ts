import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { pharmacies } from "./pharmacies";

/**
 * Pharmacy Backend Systems
 * Tracks which backend system each pharmacy uses for prescription fulfillment
 */
export const systemTypeEnum = pgEnum("pharmacy_system_type", [
  "DigitalRx",
  "PioneerRx",
  "QS1",
  "Liberty",
  "Custom",
  "BestRx",
]);

export const pharmacy_backends = pgTable(
  "pharmacy_backends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacy_id: uuid("pharmacy_id")
      .notNull()
      .references(() => pharmacies.id, { onDelete: "cascade" }),
    system_type: systemTypeEnum("system_type").notNull(),
    api_url: text("api_url"),
    api_key_encrypted: text("api_key_encrypted"),
    store_id: text("store_id"),
    location_id: text("location_id"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  () => [
    // SELECT: Admin only (contains sensitive API credentials)
    pgPolicy("pharmacy_backends_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // INSERT: Admin only
    pgPolicy("pharmacy_backends_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("pharmacy_backends_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("pharmacy_backends_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type PharmacyBackend = typeof pharmacy_backends.$inferSelect;
export type NewPharmacyBackend = typeof pharmacy_backends.$inferInsert;
