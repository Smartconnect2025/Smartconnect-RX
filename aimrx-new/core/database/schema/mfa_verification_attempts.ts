import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  timestamp,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const mfaVerificationAttempts = pgTable(
  "mfa_verification_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("mfa_attempts_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("mfa_attempts_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("mfa_attempts_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("mfa_attempts_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);
