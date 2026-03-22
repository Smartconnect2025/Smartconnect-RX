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

    const sql = postgres(databaseUrl);

    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS tiers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tier_name TEXT NOT NULL,
          tier_code TEXT NOT NULL,
          discount_percentage NUMERIC(5,2) NOT NULL,
          description TEXT,
          pharmacy_id UUID REFERENCES pharmacies(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await sql.end();

      console.log("Tiers table initialized successfully");

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
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
