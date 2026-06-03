import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uniqueIndex,
  uuid,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { paymentTransactions } from "./payment_transactions";

/**
 * Inbound RedSail (Emporos) webhook event ledger.
 *
 * Acts as the idempotency store: a unique `event_id` guarantees a redelivered
 * webhook is processed at most once. The webhook receiver runs as the service
 * role (bypasses RLS); a read policy is exposed to platform admins for auditing.
 */
export const redsailWebhookEvents = pgTable(
  "redsail_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Emporos-provided unique event identifier (idempotency key).
    eventId: text("event_id").notNull(),

    // e.g. 'payment.success', 'link_to_pay.fully_paid', 'card.boarded'
    eventType: text("event_type"),

    paymentTransactionId: uuid("payment_transaction_id").references(
      () => paymentTransactions.id,
      { onDelete: "set null" },
    ),

    payload: jsonb("payload"),

    // 'received' | 'processed' | 'ignored' | 'error'
    status: text("status").default("received").notNull(),
    error: text("error"),

    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("redsail_webhook_events_event_id_key").on(table.eventId),
    pgPolicy("redsail_webhook_events_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type RedsailWebhookEvent = typeof redsailWebhookEvents.$inferSelect;
export type InsertRedsailWebhookEvent =
  typeof redsailWebhookEvents.$inferInsert;
