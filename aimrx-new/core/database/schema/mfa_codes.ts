import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  text,
  timestamp,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const mfaCodes = pgTable(
  "mfa_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isUsed: boolean("is_used").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // SELECT: Admin only (system uses service role for MFA verification)
    pgPolicy("mfa_codes_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // INSERT: Admin only (system uses service role)
    pgPolicy("mfa_codes_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only (system uses service role)
    pgPolicy("mfa_codes_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("mfa_codes_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);
