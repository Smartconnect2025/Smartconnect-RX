import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  date,
  boolean,
  time,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";

/**
 * Provider availability exceptions table for specific date overrides
 * Allows providers to block time or add extra availability on specific dates
 */
export const providerAvailabilityExceptions = pgTable(
  "provider_availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to providers
    provider_id: uuid("provider_id")
      .references(() => providers.id, { onDelete: "cascade" })
      .notNull(),

    // The specific date for this exception
    exception_date: date("exception_date").notNull(),

    // Whether this is adding availability (true) or removing it (false)
    is_available: boolean("is_available").notNull(),

    // Time slots for the exception (nullable for full-day blocking)
    start_time: time("start_time"),
    end_time: time("end_time"),

    // Provider's timezone for interpreting the times
    provider_timezone: text("provider_timezone").notNull(),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Provider manages own, admin can manage all
    pgPolicy("provider_availability_exceptions_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_own_provider_record(${table.provider_id})
      `,
    }),
    pgPolicy("provider_availability_exceptions_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        public.is_admin(auth.uid())
        OR public.is_own_provider_record(${table.provider_id})
      `,
    }),
    pgPolicy("provider_availability_exceptions_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_own_provider_record(${table.provider_id})
      `,
    }),
    pgPolicy("provider_availability_exceptions_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`
        public.is_admin(auth.uid())
        OR public.is_own_provider_record(${table.provider_id})
      `,
    }),
  ],
);

// Type exports for TypeScript usage
export type ProviderAvailabilityException =
  typeof providerAvailabilityExceptions.$inferSelect;
export type InsertProviderAvailabilityException =
  typeof providerAvailabilityExceptions.$inferInsert;
