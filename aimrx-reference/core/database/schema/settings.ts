import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";

/**
 * Global application settings table
 * Stores system-wide configuration values
 */
export const appSettings = pgTable(
  "app_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Setting identification
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    description: text("description"),

    // Setting categorization
    category: text("category").notNull().default("general"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // Admin only access for app settings
    pgPolicy("app_settings_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("app_settings_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("app_settings_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("app_settings_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Provider-specific settings table
 * Stores configuration values that can be customized per provider
 */
export const providerSettings = pgTable(
  "provider_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to providers
    provider_id: uuid("provider_id")
      .references(() => providers.id, { onDelete: "cascade" })
      .notNull(),

    // Appointment duration settings (in minutes)
    default_telehealth_duration: integer("default_telehealth_duration")
      .notNull()
      .default(30),
    default_inperson_duration: integer("default_inperson_duration")
      .notNull()
      .default(45),

    // Available duration options for provider to offer
    allowed_durations: jsonb("allowed_durations")
      .notNull()
      .default([15, 30, 45, 60, 90]), // Array of integers

    // Service type settings
    enabled_service_types: jsonb("enabled_service_types")
      .notNull()
      .default(["telehealth", "in_person"]), // Array of strings

    // Booking preferences
    allow_patient_duration_change: boolean("allow_patient_duration_change")
      .notNull()
      .default(false),
    advance_booking_days: integer("advance_booking_days").notNull().default(30),
    min_booking_notice_hours: integer("min_booking_notice_hours")
      .notNull()
      .default(2),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Provider can see/manage own settings, admin sees all
    pgPolicy("provider_settings_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_provider_record(${table.provider_id})
    `,
    }),
    pgPolicy("provider_settings_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.is_own_provider_record(${table.provider_id})
    `,
    }),
    pgPolicy("provider_settings_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_provider_record(${table.provider_id})
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.is_own_provider_record(${table.provider_id})
    `,
    }),
    pgPolicy("provider_settings_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;
export type UpdateAppSetting = Partial<InsertAppSetting>;

export type ProviderSetting = typeof providerSettings.$inferSelect;
export type InsertProviderSetting = typeof providerSettings.$inferInsert;
export type UpdateProviderSetting = Partial<InsertProviderSetting>;
