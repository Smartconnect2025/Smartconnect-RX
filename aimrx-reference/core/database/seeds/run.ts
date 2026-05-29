import "dotenv/config";
import { seedSymptoms } from "./symptoms";
import { seedProviders } from "./providers";
import { seedPatients } from "./patients";
import { seedProducts } from "./products";
import { seedAdmin } from "./admin";
import { seedTags } from "./tags";

/**
 * Main seed function that runs all seed scripts
 */
export async function runAllSeeds() {
  try {
    // Run all seed functions in order
    // Note: Products depends on categories, so categories are seeded within products.ts
    await seedAdmin();
    await seedProviders();
    await seedPatients();

    await seedSymptoms();

    await seedProducts();
    await seedTags();
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

/**
 * Main function that can be run directly
 */
export async function main() {
  await runAllSeeds();
  process.exit(0);
}

// Run the seeds if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
}
