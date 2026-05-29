import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  integer,
  time,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";

/**
 * Provider availability table for recurring weekly schedules
 * Defines when providers are available on each day of the week
 */
export const providerAvailability = pgTable(
  "provider_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to providers
    provider_id: uuid("provider_id")
      .references(() => providers.id, { onDelete: "cascade" })
      .notNull(),

    // Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    day_of_week: integer("day_of_week").notNull(),

    // Time slots (stored in provider's timezone)
    start_time: time("start_time").notNull(),
    end_time: time("end_time").notNull(),

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
    // All authenticated users can read (for booking UI)
    pgPolicy("provider_availability_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // Provider manages own, admin can manage all
    pgPolicy("provider_availability_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.is_own_provider_record(${table.provider_id})
    `,
    }),
    pgPolicy("provider_availability_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_provider_record(${table.provider_id})
    `,
    }),
    pgPolicy("provider_availability_delete_policy", {
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
export type ProviderAvailability = typeof providerAvailability.$inferSelect;
export type InsertProviderAvailability =
  typeof providerAvailability.$inferInsert;
