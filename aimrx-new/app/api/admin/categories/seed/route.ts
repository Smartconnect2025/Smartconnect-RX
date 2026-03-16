import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { categoriesData } from "@/core/database/seeds/data/categories";

export async function POST() {
  try {
    const supabase = createAdminClient();

    const results = [];
    const validSlugs = categoriesData.map((c) => c.slug);

    for (const cat of categoriesData) {
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", cat.slug)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from("categories")
          .update({
            name: cat.name,
            description: cat.description,
            color: cat.color,
            image_url: cat.image_url,
            display_order: cat.display_order,
            is_active: cat.is_active,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          results.push({ slug: cat.slug, action: "error", error: error.message });
        } else {
          results.push({ slug: cat.slug, action: "updated", id: data.id });
        }
      } else {
        const { data, error } = await supabase
          .from("categories")
          .insert(cat)
          .select()
          .single();

        if (error) {
          results.push({ slug: cat.slug, action: "error", error: error.message });
        } else {
          results.push({ slug: cat.slug, action: "created", id: data.id });
        }
      }
    }

    const { data: allCategories } = await supabase
      .from("categories")
      .select("id, slug, name");

    const cleaned = [];
    if (allCategories) {
      for (const cat of allCategories) {
        if (!validSlugs.includes(cat.slug)) {
          const { error: deleteError } = await supabase
            .from("categories")
            .delete()
            .eq("id", cat.id);

          if (deleteError) {
            const { error: deactivateError } = await supabase
              .from("categories")
              .update({ is_active: false })
              .eq("id", cat.id);

            cleaned.push({
              slug: cat.slug,
              name: cat.name,
              id: cat.id,
              action: deactivateError ? "failed" : "deactivated",
            });
          } else {
            cleaned.push({ slug: cat.slug, name: cat.name, id: cat.id, action: "deleted" });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      cleaned,
      message: `Processed ${results.length} categories, cleaned ${cleaned.length} old categories`,
    });
  } catch (error) {
    console.error("Error seeding categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed categories" },
      { status: 500 }
    );
  }
}
