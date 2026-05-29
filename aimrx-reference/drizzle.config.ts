import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./core/database/migrations",
  schema: "./core/database/schema/index.ts",
  schemaFilter: ["public"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    prefix: "timestamp",
    table: "__drizzle_migrations__",
    schema: "public",
  },
  strict: true,
  verbose: true,
  breakpoints: false,
});
