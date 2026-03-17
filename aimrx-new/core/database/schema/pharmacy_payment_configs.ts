import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { pharmacies } from "./pharmacies";

export const pharmacyPaymentConfigs = pgTable(
  "pharmacy_payment_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pharmacyId: uuid("pharmacy_id")
      .references(() => pharmacies.id, { onDelete: "cascade" })
      .notNull(),
    gateway: text("gateway").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    environment: text("environment").default("sandbox").notNull(),
    label: text("label"),

    stripeSecretKeyEncrypted: text("stripe_secret_key_encrypted"),
    stripePublishableKey: text("stripe_publishable_key"),
    stripeWebhookSecretEncrypted: text("stripe_webhook_secret_encrypted"),

    authnetApiLoginIdEncrypted: text("authnet_api_login_id_encrypted"),
    authnetTransactionKeyEncrypted: text("authnet_transaction_key_encrypted"),
    authnetSignatureKeyEncrypted: text("authnet_signature_key_encrypted"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("pharmacy_payment_configs_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_pharmacy_admin(${table.pharmacyId})
      `,
    }),
    pgPolicy("pharmacy_payment_configs_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        public.is_admin(auth.uid())
        OR public.is_pharmacy_admin(${table.pharmacyId})
      `,
    }),
    pgPolicy("pharmacy_payment_configs_update_policy", {
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
    pgPolicy("pharmacy_payment_configs_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type PharmacyPaymentConfig = typeof pharmacyPaymentConfigs.$inferSelect;
export type InsertPharmacyPaymentConfig = typeof pharmacyPaymentConfigs.$inferInsert;
