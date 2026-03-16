import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  varchar,
  date,
  jsonb,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";

/**
 * Patients table for patient information
 * Stores patient data and links to auth users
 */
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to auth user
    user_id: uuid("user_id")
      .references(() => authUsers.id, { onDelete: "cascade" })
      .unique(),

    // Basic patient information
    first_name: varchar("first_name", { length: 255 }).notNull(),
    last_name: varchar("last_name", { length: 255 }).notNull(),
    date_of_birth: date("date_of_birth").notNull(),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    avatar_url: text("avatar_url"),

    // Additional data stored as JSONB (intake data, medical history, etc.)
    data: jsonb("data"),

    // Address Information (for billing and physical location)
    physical_address: jsonb("physical_address"), // { street, city, state, zipCode, country }
    billing_address: jsonb("billing_address"), // { street, city, state, zipCode, country }

    // EMR integration fields
    emr_data: jsonb("emr_data"),
    provider_id: uuid("provider_id").references(() => providers.id),
    status: varchar("status", { length: 50 }),
    emr_created_at: timestamp("emr_created_at", { withTimezone: true }),
    emr_updated_at: timestamp("emr_updated_at", { withTimezone: true }),

    // Active status
    is_active: boolean("is_active").default(true).notNull(),

    // Stripe payment integration
    stripe_customer_id: text("stripe_customer_id"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own record, providers see assigned patients, admins see all
    pgPolicy("patients_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
      OR public.provider_has_patient_access(${table.id})
    `,
    }),
    // INSERT: Admin, provider, or self-registration (user creates their own patient record)
    pgPolicy("patients_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
      OR public.is_provider()
    `,
    }),
    // UPDATE: Own record, assigned provider, or admin
    pgPolicy("patients_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
      OR public.provider_has_patient_access(${table.id})
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
      OR public.provider_has_patient_access(${table.id})
    `,
    }),
    // DELETE: Admin only
    pgPolicy("patients_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;
export type UpdatePatient = Partial<InsertPatient>;
