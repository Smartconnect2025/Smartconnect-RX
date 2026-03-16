import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";

/**
 * User addresses table for storing shipping and billing addresses
 * Stores multiple addresses per user with primary address designation
 */
export const userAddresses = pgTable(
  "user_addresses",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to auth user
    user_id: uuid("user_id")
      .references(() => authUsers.id, { onDelete: "cascade" })
      .notNull(),

    // Address recipient information
    given_name: text("given_name").notNull(), // First name
    family_name: text("family_name").notNull(), // Last name
    phone: text("phone"), // Contact phone number

    // Address details
    address_line_1: text("address_line_1").notNull(), // Street address
    address_line_2: text("address_line_2"), // Apartment, suite, etc.
    city: text("city").notNull(),
    state: text("state").notNull(),
    postal_code: text("postal_code").notNull(),

    // Address preferences
    is_primary: boolean("is_primary").notNull().default(false), // Primary address flag

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Own addresses or admin
    pgPolicy("user_addresses_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // INSERT: Own addresses only
    pgPolicy("user_addresses_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.user_id} = auth.uid()`,
    }),
    // UPDATE: Own addresses or admin
    pgPolicy("user_addresses_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
      withCheck: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // DELETE: Own addresses or admin
    pgPolicy("user_addresses_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports for use in application code
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = typeof userAddresses.$inferInsert;
export type UpdateUserAddress = Partial<InsertUserAddress>;
