import { createServerClient } from "@core/supabase/server";

/**
 * Ensures the tiers table exists in the database
 * Creates it automatically if it doesn't exist
 */
export async function ensureTiersTable(): Promise<void> {
  const supabase = await createServerClient();

  try {
    // First, try to check if table exists by querying it
    const { error: checkError } = await supabase
      .from("tiers")
      .select("id")
      .limit(1);

    // If no error, table exists
    if (!checkError) {
      return;
    }

    // If error code is 42P01, table doesn't exist - create it
    if (checkError.code === "42P01" || checkError.message?.includes("does not exist")) {
      console.log("Tiers table doesn't exist, creating it now...");

      // Use raw SQL to create the table
      const { error: createError } = await supabase.rpc("exec_sql", {
        sql: `
          -- Create tiers table
          CREATE TABLE IF NOT EXISTS tiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tier_name TEXT NOT NULL UNIQUE,
            tier_code TEXT NOT NULL UNIQUE,
            discount_percentage NUMERIC(5,2) NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          -- Insert default tiers
          INSERT INTO tiers (tier_name, tier_code, discount_percentage, description) VALUES
            ('Tier 1', 'tier1', 10.00, 'Basic tier with 10% discount'),
            ('Tier 2', 'tier2', 15.00, 'Standard tier with 15% discount'),
            ('Tier 3', 'tier3', 20.00, 'Premium tier with 20% discount')
          ON CONFLICT (tier_code) DO NOTHING;
        `
      });

      if (createError) {
        console.error("Failed to create tiers table via RPC:", createError);
        throw new Error(`Could not create tiers table: ${createError.message}`);
      }

      console.log("✅ Tiers table created successfully");
    }
  } catch (error) {
    console.error("Error ensuring tiers table exists:", error);
    // Don't throw - let the calling code handle the error
  }
}
