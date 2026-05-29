import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  date,
  text,
  numeric,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";

/**
 * Goals table for patient goal tracking
 * Stores user-defined health and wellness goals
 */
export const goals = pgTable(
  "goals",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to auth user
    user_id: uuid("user_id")
      .references(() => authUsers.id, { onDelete: "cascade" })
      .notNull(),

    // Goal details
    metric: text("metric").notNull(), // What is being measured
    description: text("description"), // Goal description
    target_value: text("target_value").notNull(), // Target to achieve
    current_value: text("current_value").notNull().default("0"), // Current progress
    unit: text("unit").notNull(), // Unit of measurement

    // Goal categorization
    type: text("type").notNull(), // Type of goal (e.g., "common", "custom", "provider")
    category: text("category").notNull(), // Category (e.g., "exercise", "nutrition", "medication")
    custom_goal: text("custom_goal"), // Custom goal text if type is custom

    // Progress tracking
    progress: numeric("progress").notNull().default("0"), // Progress percentage
    status: text("status").notNull().default("not-started"), // Current status
    tracking_source: text("tracking_source").notNull().default("manual"), // How progress is tracked

    // Timeline
    timeframe: text("timeframe").notNull(), // Goal timeframe
    start_date: date("start_date").notNull(),
    end_date: date("end_date").notNull(),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    last_updated: timestamp("last_updated", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // SELECT: Own goals or admin
    pgPolicy("goals_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // INSERT: Own goals only
    pgPolicy("goals_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.user_id} = auth.uid()`,
    }),
    // UPDATE: Own goals or admin
    pgPolicy("goals_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
      withCheck: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
    // DELETE: Own goals or admin
    pgPolicy("goals_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
    }),
  ],
);

/**
 * Goal progress table for tracking progress entries
 * Stores individual progress updates for goals
 */
export const goalProgress = pgTable(
  "goal_progress",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    goal_id: uuid("goal_id")
      .references(() => goals.id, { onDelete: "cascade" })
      .notNull(),

    // Progress details
    current: numeric("current").notNull(), // Current value at this point in time
    date: date("date").notNull(), // Date of this progress entry
    notes: text("notes"), // Optional notes about this progress entry
  },
  (table) => [
    // SELECT: Via goal ownership
    pgPolicy("goal_progress_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = ${table.goal_id}
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
    }),
    // INSERT: Via goal ownership
    pgPolicy("goal_progress_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = ${table.goal_id}
        AND g.user_id = auth.uid()
      )
    `,
    }),
    // UPDATE: Via goal ownership or admin
    pgPolicy("goal_progress_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = ${table.goal_id}
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
      withCheck: sql`
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = ${table.goal_id}
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
    }),
    // DELETE: Via goal ownership or admin
    pgPolicy("goal_progress_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = ${table.goal_id}
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    `,
    }),
  ],
);

// Type exports for use in application code
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;
export type UpdateGoal = Partial<InsertGoal>;

export type GoalProgress = typeof goalProgress.$inferSelect;
export type InsertGoalProgress = typeof goalProgress.$inferInsert;
export type UpdateGoalProgress = Partial<InsertGoalProgress>;
