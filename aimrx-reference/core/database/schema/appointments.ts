import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  integer,
  text,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { providers } from "./providers";
import { patients } from "./patients";

/**
 * Appointments table for healthcare appointment scheduling
 * Links providers and patients with appointment details
 */
export const appointments = pgTable(
  "appointments",
  {
    // Primary key - also serves as meeting code
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    provider_id: uuid("provider_id")
      .references(() => providers.id, { onDelete: "cascade" })
      .notNull(),
    patient_id: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),

    // Appointment details
    datetime: timestamp("datetime", { withTimezone: true }).notNull(), // Appointment date and time
    duration: integer("duration").notNull(), // Duration in minutes
    type: text("type").notNull(), // Appointment type (video, phone, chat, etc.)
    reason: text("reason").notNull(), // Purpose/reason for the appointment

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Patient sees own, provider sees assigned patients, admin sees all
    pgPolicy("appointments_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // INSERT: Patient can book, provider can create, admin
    pgPolicy("appointments_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // UPDATE: Patient, provider, or admin
    pgPolicy("appointments_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patient_id})
      OR public.provider_has_patient_access(${table.patient_id})
    `,
    }),
    // DELETE: Admin only
    pgPolicy("appointments_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
export type UpdateAppointment = Partial<InsertAppointment>;

// Common appointment types (not enforced at DB level, but used in application)
export type AppointmentType =
  | "video"
  | "phone"
  | "chat"
  | "consultation"
  | "followup"
  | "therapy"
  | "assessment"
  | "emergency";
