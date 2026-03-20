/**
 * Tiers Table Initialization API
 *
 * This endpoint creates the tiers table if it doesn't exist
 * Called automatically by the frontend when tier operations fail
 */

import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import postgres from "postgres";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST() {
  try {
    const platformCheck = await requirePlatformAdmin();
    if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: "Database URL not configured" },
        { status: 500 },
      );
    }

    // Create direct postgres connection for DDL operations
    const sql = postgres(databaseUrl);

    try {
      // Create the tiers table
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS tiers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tier_name TEXT NOT NULL UNIQUE,
          tier_code TEXT NOT NULL UNIQUE,
          discount_percentage NUMERIC(5,2) NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Insert default tiers
      await sql.unsafe(`
        INSERT INTO tiers (tier_name, tier_code, discount_percentage, description) VALUES
          ('Tier 1', 'tier1', 10.00, 'Basic tier with 10% discount'),
          ('Tier 2', 'tier2', 15.00, 'Standard tier with 15% discount'),
          ('Tier 3', 'tier3', 20.00, 'Premium tier with 20% discount')
        ON CONFLICT (tier_code) DO NOTHING;
      `);

      await sql.end();

      console.log("✅ Tiers table initialized successfully");

      return NextResponse.json({
        success: true,
        message: "Tiers table initialized successfully",
      });
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error("Error initializing tiers table:", error);
    return NextResponse.json(
      {
        error: "Failed to initialize tiers table",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 },
    );
  }
}
