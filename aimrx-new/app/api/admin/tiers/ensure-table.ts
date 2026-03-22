import { createServerClient } from "@core/supabase/server";

export async function ensureTiersTable(): Promise<void> {
  const supabase = await createServerClient();

  try {
    const { error: checkError } = await supabase
      .from("tiers")
      .select("id")
      .limit(1);

    if (!checkError) {
      return;
    }

    if (checkError.code === "42P01" || checkError.message?.includes("does not exist")) {
      console.log("Tiers table doesn't exist, creating it now...");

      const { error: createError } = await supabase.rpc("exec_sql", {
        sql: `
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
        `,
      });

      if (createError) {
        console.error("Failed to create tiers table via RPC:", createError);
        throw new Error(`Could not create tiers table: ${createError.message}`);
      }

      console.log("Tiers table created successfully");
    }
  } catch (error) {
    console.error("Error ensuring tiers table exists:", error);
  }
}
