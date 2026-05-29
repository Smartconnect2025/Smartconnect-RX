import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";

/**
 * Delegate profiles table — assistant-only profile data.
 *
 * An assistant (delegate) has no providers row. This table stores
 * the assistant's own physical and billing addresses, captured after
 * the assistant signs the delegation agreement.
 *
 * Strict isolation guarantees:
 *   - Touches no provider data, no delegations data.
 *   - Activation gating that uses this data is computed in app layer
 *     only; delegations.status semantics are unchanged.
 *
 * Address shape mirrors providers.{physical,billing}_address:
 *   { street, city, state, zipCode, country }
 */
export const delegateProfiles = pgTable(
  "delegate_profiles",
  {
    delegate_user_id: uuid("delegate_user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),

    physical_address: jsonb("physical_address"),
    billing_address: jsonb("billing_address"),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: own row OR admin
    pgPolicy("delegate_profiles_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.delegate_user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // INSERT: own row only (admin writes go via service-role server routes)
    pgPolicy("delegate_profiles_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.delegate_user_id} = auth.uid()`,
    }),
    // UPDATE: own row only
    pgPolicy("delegate_profiles_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.delegate_user_id} = auth.uid()`,
      withCheck: sql`${table.delegate_user_id} = auth.uid()`,
    }),
    // DELETE: admin only (cleanup); cascades from auth.users automatically
    pgPolicy("delegate_profiles_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type DelegateProfile = typeof delegateProfiles.$inferSelect;
export type InsertDelegateProfile = typeof delegateProfiles.$inferInsert;
export type UpdateDelegateProfile = Partial<InsertDelegateProfile>;

export type DelegateAddress = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};
