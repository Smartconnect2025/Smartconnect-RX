import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const payOnTermsEmailRecipients = pgTable(
  "pay_on_terms_email_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const payOnTermsEmailSchedule = pgTable("pay_on_terms_email_schedule", {
  id: integer("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  frequency: text("frequency").notNull().default("off"),
  sendHourUtc: integer("send_hour_utc").notNull().default(14),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  /**
   * The end (exclusive) of the window covered by the most recent successful
   * send. Used so the cron path can resume cleanly if it ever misses a tick
   * and so the UI can show "last covered through ..." to the admin.
   */
  lastWindowEnd: timestamp("last_window_end", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PayOnTermsEmailRecipient = typeof payOnTermsEmailRecipients.$inferSelect;
export type PayOnTermsEmailSchedule = typeof payOnTermsEmailSchedule.$inferSelect;
