import { sql } from "drizzle-orm";
import { pgEnum, pgTable, pgPolicy, uuid, bigint, boolean } from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";

// Enum for user roles in the application
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "provider"]);

/**
 * User roles table for role-based access control
 * Links users to their assigned roles in the system
 */
export const userRoles = pgTable("user_roles", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: uuid("user_id")
    .references(() => authUsers.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  // Role assignment
  role: userRoleEnum("role").notNull(),

  // Demo mode flag - demo users can view all data but cannot modify anything
  is_demo: boolean("is_demo").notNull().default(false),
}, (table) => [
  // SELECT: Users can read their own role
  pgPolicy("user_roles_select_own", {
    for: "select",
    to: authenticatedRole,
    using: sql`auth.uid() = ${table.user_id}`,
  }),
  // SELECT: Admins can read all roles
  pgPolicy("user_roles_select_admin", {
    for: "select",
    to: authenticatedRole,
    using: sql`public.is_admin(auth.uid())`,
  }),
  // INSERT: Only admins can insert roles
  pgPolicy("user_roles_insert_admin", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`public.is_admin(auth.uid())`,
  }),
  // UPDATE: Only admins can update roles
  pgPolicy("user_roles_update_admin", {
    for: "update",
    to: authenticatedRole,
    using: sql`public.is_admin(auth.uid())`,
    withCheck: sql`public.is_admin(auth.uid())`,
  }),
  // DELETE: Only admins can delete roles
  pgPolicy("user_roles_delete_admin", {
    for: "delete",
    to: authenticatedRole,
    using: sql`public.is_admin(auth.uid())`,
  }),
]);

// Type exports for use in application code
export type UserRole = typeof userRoles.$inferSelect;
