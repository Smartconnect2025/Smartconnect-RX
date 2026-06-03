import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uniqueIndex,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { pharmacies } from "./pharmacies";

/**
 * RedSail Pay (Emporos Payments) configuration, stored separately from
 * `pharmacy_payment_configs` so the existing live Stripe / Authorize.Net flow
 * is never touched. A pharmacy only routes patients to RedSail when a row here
 * is BOTH `is_active` AND `is_connected`, and the global REDSAIL_ENABLED flag is on.
 */
export const redsailPaymentConfigs = pgTable(
  "redsail_payment_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id")
      .references(() => pharmacies.id, { onDelete: "cascade" })
      .notNull(),

    // Emporos environment: 'ftr1' (dev sandbox), 'prv' (preview), 'production'
    environment: text("environment").default("ftr1").notNull(),

    // Emporos tenant / location identifiers (provided by RedSail)
    tenantId: text("tenant_id"),
    siteId: text("site_id"),
    stationId: text("station_id"),

    // OIDC client-credentials used to authenticate to the Payments Domain
    oidcClientId: text("oidc_client_id"),
    oidcClientSecretEncrypted: text("oidc_client_secret_encrypted"),

    // Expected audience/issuer for inbound webhook bearer tokens (OIDC)
    webhookAudience: text("webhook_audience"),

    // Optional explicit API base URL override (otherwise derived from environment)
    apiBaseUrl: text("api_base_url"),

    // OFF by default — never auto-route patients until an admin opts in
    isActive: boolean("is_active").default(false).notNull(),
    // Flipped true only after a successful live connection verification
    isConnected: boolean("is_connected").default(false).notNull(),

    label: text("label"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One RedSail config per pharmacy (deterministic upsert).
    uniqueIndex("redsail_payment_configs_pharmacy_id_key").on(table.pharmacyId),
    pgPolicy("redsail_payment_configs_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_pharmacy_admin(${table.pharmacyId})
      `,
    }),
    pgPolicy("redsail_payment_configs_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        public.is_admin(auth.uid())
        OR public.is_pharmacy_admin(${table.pharmacyId})
      `,
    }),
    pgPolicy("redsail_payment_configs_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_pharmacy_admin(${table.pharmacyId})
      `,
      withCheck: sql`
        public.is_admin(auth.uid())
        OR public.is_pharmacy_admin(${table.pharmacyId})
      `,
    }),
    pgPolicy("redsail_payment_configs_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type RedsailPaymentConfig = typeof redsailPaymentConfigs.$inferSelect;
export type InsertRedsailPaymentConfig =
  typeof redsailPaymentConfigs.$inferInsert;
