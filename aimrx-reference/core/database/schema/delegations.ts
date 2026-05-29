import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";

/**
 * Delegations table — "Provider Assistance" feature.
 *
 * A delegation represents an assistant (e.g. office nurse, MA) authorized
 * by a provider to submit prescriptions ON HIS BEHALF, under HIS NPI.
 *
 * The assistant has NO NPI of her own. The provider remains the legal
 * prescriber on every prescription. The pharmacy never knows a delegate
 * was involved — it sees only the provider.
 *
 * Lifecycle:
 *   pending_admin → admin approves → pending_delegate → delegate signs → active
 *   pending_admin → admin rejects → rejected
 *   active → provider/admin revokes → revoked
 */
export const delegations = pgTable(
  "delegations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The assistant — auth account created lazily after admin approves
    delegate_user_id: uuid("delegate_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    delegate_first_name: text("delegate_first_name").notNull(),
    delegate_last_name: text("delegate_last_name").notNull(),
    delegate_email: text("delegate_email").notNull(),
    delegate_phone: text("delegate_phone"),
    delegate_title: text("delegate_title").notNull(), // provider-set: "Office Nurse", "MA", etc.

    // The authorizing provider
    provider_id: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),

    // Scope — what she can submit (delegate acts as full provider equivalent)
    scope_refills: boolean("scope_refills").notNull().default(true),
    scope_new_rx: boolean("scope_new_rx").notNull().default(true),

    // Lifecycle status
    status: text("status").notNull().default("pending_admin"),
    // pending_admin | pending_delegate | active | rejected | revoked

    // Agreement snapshot (architect requirement: versioned, hashed)
    agreement_version: integer("agreement_version").notNull(),
    agreement_text_hash: text("agreement_text_hash").notNull(),
    agreement_text_snapshot: text("agreement_text_snapshot").notNull(),

    // Provider's signature at time of request (snapshot of providers.signature_url)
    provider_signature_url: text("provider_signature_url").notNull(),
    provider_signed_at: timestamp("provider_signed_at", {
      withTimezone: true,
    }).notNull(),
    provider_signed_ip: text("provider_signed_ip").notNull(),

    // Assistant's acknowledgment (captured at first login — Phase 2)
    delegate_signature_url: text("delegate_signature_url"),
    delegate_signed_at: timestamp("delegate_signed_at", {
      withTimezone: true,
    }),
    delegate_signed_ip: text("delegate_signed_ip"),

    // Admin action
    admin_user_id: uuid("admin_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    admin_action_at: timestamp("admin_action_at", { withTimezone: true }),
    admin_rejection_reason: text("admin_rejection_reason"),

    // Revoke
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    revoked_by: uuid("revoked_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    revoke_reason: text("revoke_reason"),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delegations_provider_status_idx").on(table.provider_id, table.status),
    index("delegations_delegate_user_idx").on(table.delegate_user_id),
    // Only one active/pending delegation per provider+email pair
    uniqueIndex("delegations_one_active_per_pair_idx")
      .on(table.provider_id, table.delegate_email)
      .where(sql`status IN ('pending_admin','pending_delegate','active')`),

    // Lifecycle guards (architect requirement)
    check("delegations_scope_check", sql`scope_refills OR scope_new_rx`),
    check(
      "delegations_status_check",
      sql`status IN ('pending_admin','pending_delegate','active','rejected','revoked')`,
    ),
    check(
      "delegations_active_requires_signature",
      sql`status <> 'active' OR (delegate_user_id IS NOT NULL AND delegate_signed_at IS NOT NULL)`,
    ),
    check(
      "delegations_pending_delegate_requires_user",
      sql`status <> 'pending_delegate' OR delegate_user_id IS NOT NULL`,
    ),

    // RLS: admin sees all; provider sees own; delegate sees rows where she's the delegate
    pgPolicy("delegations_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR ${table.delegate_user_id} = auth.uid()
        OR EXISTS (
          SELECT 1 FROM providers p
          WHERE p.id = ${table.provider_id} AND p.user_id = auth.uid()
        )
      `,
    }),
    // INSERT: admin only (via authenticated session). Provider-initiated
    // creation in Phase 2 will go through a Next.js API route that uses
    // the service-role client (which bypasses RLS) so it can validate the
    // request and enforce the lifecycle before inserting.
    pgPolicy("delegations_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: admin only (via authenticated session). Delegate's first-login
    // signature flow and provider's revoke flow in Phase 2/3 also go through
    // server routes using the service-role client.
    pgPolicy("delegations_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: admin only
    pgPolicy("delegations_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type Delegation = typeof delegations.$inferSelect;
export type InsertDelegation = typeof delegations.$inferInsert;
export type UpdateDelegation = Partial<InsertDelegation>;

export type DelegationStatus =
  | "pending_admin"
  | "pending_delegate"
  | "active"
  | "rejected"
  | "revoked";

// Current agreement version. Bump this whenever the legal text changes.
export const CURRENT_AGREEMENT_VERSION = 1;
