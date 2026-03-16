import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  date,
  integer,
  jsonb,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { groups } from "./groups";

// Provider-specific enums
export const genderEnum = pgEnum("provider_gender", ["male", "female"]);
export const experienceLevelEnum = pgEnum("experience_level", [
  "entry",
  "mid",
  "senior",
  "expert",
]);
export const practiceTypeEnum = pgEnum("practice_type", [
  "solo",
  "group",
  "hospital",
  "clinic",
  "telehealth",
]);

/**
 * Providers table for healthcare providers
 * Stores provider information and links to auth users
 */
export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to auth user
    user_id: uuid("user_id")
      .references(() => authUsers.id, { onDelete: "cascade" })
      .unique(),

    // Group assignment
    group_id: uuid("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),

    // Personal Information
    first_name: text("first_name"),
    last_name: text("last_name"),
    date_of_birth: date("date_of_birth"),
    gender: genderEnum("gender"),
    avatar_url: text("avatar_url"),
    signature_url: text("signature_url"), // Signature image as base64 data URL

    // Contact Information
    email: text("email"),
    phone_number: text("phone_number"),
    company_name: text("company_name"),
    email_verified: timestamp("email_verified", { withTimezone: true }),
    phone_verified: timestamp("phone_verified", { withTimezone: true }),

    // Professional Information
    npi_number: text("npi_number").unique(), // National Provider Identifier (10 digits) - must be unique
    dea_number: text("dea_number"), // DEA Registration Number for controlled substance prescriptions
    specialties: jsonb("specialties"), // Array of specialty objects
    medical_licenses: jsonb("medical_licenses"), // Array of license objects with state and number
    board_certifications: jsonb("board_certifications"), // Array of certification objects
    education_training: jsonb("education_training"), // Array of education objects
    languages_spoken: jsonb("languages_spoken"), // Array of language objects
    professional_associations: jsonb("professional_associations"), // Array of association objects
    years_of_experience: integer("years_of_experience"),
    professional_bio: text("professional_bio"),

    // Practice Details
    practice_type: practiceTypeEnum("practice_type"),
    practice_address: jsonb("practice_address"), // Object with address fields
    services_offered: jsonb("services_offered"), // Array of service objects
    insurance_plans_accepted: jsonb("insurance_plans_accepted"), // Array of insurance objects
    hospital_affiliations: jsonb("hospital_affiliations"), // Array of affiliation objects

    // Address Information (for billing and physical location)
    physical_address: jsonb("physical_address"), // { street, city, state, zipCode, country }
    billing_address: jsonb("billing_address"), // { street, city, state, zipCode, country }

    // Payment/Billing Information (for paying provider)
    tax_id: text("tax_id"), // Tax ID/EIN for provider payments
    payment_details: jsonb("payment_details"), // { bank_name, account_holder_name, account_number, routing_number, account_type, swift_code }
    payment_method: text("payment_method"), // "bank_transfer", "check", "paypal", "stripe"
    payment_schedule: text("payment_schedule"), // "monthly", "bi-weekly", "weekly"
    tier_level: text("tier_level"), // Tier level set by admin (Tier 1, Tier 2, Tier 3, Tier 4) - each tier has different discount rate
    default_shipping_fee: integer("default_shipping_fee").default(40), // Default shipping fee for prescriptions

    // Legacy fields (maintaining backward compatibility)
    specialty: text("specialty"), // Primary specialty for backward compatibility
    licensed_states: text("licensed_states").array(),
    service_types: text("service_types").array(),
    insurance_plans: text("insurance_plans").array(),

    // Status
    is_active: boolean("is_active").notNull().default(true),
    is_verified: boolean("is_verified").notNull().default(false), // Email MFA verification status

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Own profile, active providers for booking, assigned patients' providers, admin
    pgPolicy("providers_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
      OR ${table.is_active} = true
    `,
    }),
    // INSERT: Admin or self-registration
    pgPolicy("providers_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
    `,
    }),
    // UPDATE: Own profile or admin
    pgPolicy("providers_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR ${table.user_id} = auth.uid()
    `,
    }),
    // DELETE: Admin only
    pgPolicy("providers_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type Provider = typeof providers.$inferSelect;
export type InsertProvider = typeof providers.$inferInsert;
export type UpdateProvider = Partial<InsertProvider>;

// Enum type exports for use throughout the application
export type ProviderGender = (typeof genderEnum.enumValues)[number];
export type ExperienceLevel = (typeof experienceLevelEnum.enumValues)[number];
export type PracticeType = (typeof practiceTypeEnum.enumValues)[number];

// Enum constants for use in forms and validation
export const PROVIDER_GENDERS = genderEnum.enumValues;
export const EXPERIENCE_LEVELS = experienceLevelEnum.enumValues;
export const PRACTICE_TYPES = practiceTypeEnum.enumValues;
