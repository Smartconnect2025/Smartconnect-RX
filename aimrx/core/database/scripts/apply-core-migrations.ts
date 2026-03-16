#!/usr/bin/env tsx
import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Apply core security migrations that need to run after initial schema setup
 */
async function applyCoreMigrations() {
  // Connection string from environment
  const databaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required");
  }

  // Create a postgres connection
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  const coreMigrations = [
    {
      file: "01_secure_drizzle_table.sql",
      description: "Securing drizzle migrations table",
    },
    {
      file: "02_create_all_storage_buckets.sql",
      description:
        "Creating storage buckets for avatars, resources, and products",
    },
    {
      file: "03_user_roles_rls.sql",
      description: "Setting up Row Level Security for user_roles table",
    },
  ];

  try {
    // Step 1: Check if initial migrations have been run
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '__drizzle_migrations__'
      ) as migrations_exist
    `);

    const migrationsExist = result[0]?.migrations_exist;

    if (!migrationsExist) {
      await client.end();
      process.exit(1);
    }

    // Step 2: Apply core infrastructure migrations
    for (const migration of coreMigrations) {
      const sqlPath = join(__dirname, "..", "core-migrations", migration.file);

      const sqlContent = readFileSync(sqlPath, "utf-8");

      try {
        // Execute the SQL file
        await client.unsafe(sqlContent);
      } catch (error) {
        // Check if it's an error because the changes already exist
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage?.includes("already exists") ||
          errorMessage?.includes("duplicate") ||
          errorMessage?.includes("multiple primary keys")
        ) {
          // Already applied, skip
        } else {
          console.error(
            `Error applying ${migration.file}:`,
            errorMessage,
          );
          throw error;
        }
      }
    }
  } catch (error) {
    console.error("Core migrations setup failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  applyCoreMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Failed to apply core migrations:", error);
      process.exit(1);
    });
}

export { applyCoreMigrations };
