import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // 'doctor' or 'pharmacy'
    status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'

    // Common fields
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email").notNull(),
    phone: text("phone"),

    // Store all form data as JSON
    formData: jsonb("form_data").notNull(),

    // Approval tracking
    reviewedBy: uuid("reviewed_by"), // user_id of admin who reviewed
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    // SELECT: Admin only
    pgPolicy("access_requests_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // INSERT: Admin only (anonymous users submit via API with service role)
    pgPolicy("access_requests_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    // UPDATE: Admin only
    pgPolicy("access_requests_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // DELETE: Admin only
    pgPolicy("access_requests_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

export type AccessRequest = typeof accessRequests.$inferSelect;
export type NewAccessRequest = typeof accessRequests.$inferInsert;
