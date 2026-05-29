import { createSeedClient } from "../client";
import { productsData } from "./data/products";
import { categoriesData } from "./data/categories";
import type { Category, Product } from "../schema";

export async function seedCategories() {
  try {
    const supabase = createSeedClient();

    // Insert or update category data with conflict resolution
    const { data, error } = await supabase
      .from("categories")
      .upsert(categoriesData, { onConflict: "slug", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error seeding categories:", error);
    throw error;
  }
}

export async function seedProducts() {
  try {
    const supabase = createSeedClient();

    // Test connection first
    const { error: testError } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("Database connection test failed:", testError);
      throw testError;
    }

    // Ensure categories exist first
    await seedCategories();

    // Insert or update product data with conflict resolution
    const { data, error } = await supabase
      .from("products")
      .upsert(productsData, { onConflict: "slug", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error seeding products:", error);
    throw error;
  }
}

export async function main() {
  await seedProducts();
  process.exit(0);
}

// Run the seed if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
