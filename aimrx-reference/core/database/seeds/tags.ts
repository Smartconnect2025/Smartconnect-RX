import { createSeedClient } from "../client";
import { tagsData } from "./data/tags";
import type { Tag } from "../schema";

export async function seedTags() {
  try {
    const supabase = createSeedClient();

    // Test connection first
    const { error: testError } = await supabase
      .from("tags")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("Database connection test failed:", testError);
      throw testError;
    }

    // Insert or update tag data with conflict resolution
    const { data, error } = await supabase
      .from("tags")
      .upsert(tagsData, { onConflict: "slug", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error seeding tags:", error);
    throw error;
  }
}

export async function main() {
  await seedTags();
  process.exit(0);
}

// Run the seed if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
