import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  text,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Cron job runs table for tracking every cron execution
 * Each row represents a single run of a scheduled job
 */
export const cronJobRuns = pgTable(
  "cron_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Which job ran
    job_name: text("job_name").notNull(), // e.g. "refill-check", "tracking-poll"

    // Execution details
    status: text("status").notNull().default("running"), // "running" | "success" | "partial" | "error"
    error_message: text("error_message"),
    records_processed: integer("records_processed").default(0),
    details: jsonb("details"), // { processed: [...], failed: [...] }

    // Timing
    started_at: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    duration_ms: integer("duration_ms"),
  },
  () => [
    // Only admins can view cron logs
    pgPolicy("cron_job_runs_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    // Inserts/updates happen via service role (no RLS needed), but define policy for safety
    pgPolicy("cron_job_runs_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("cron_job_runs_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
    pgPolicy("cron_job_runs_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports
export type CronJobRun = typeof cronJobRuns.$inferSelect;
export type InsertCronJobRun = typeof cronJobRuns.$inferInsert;
