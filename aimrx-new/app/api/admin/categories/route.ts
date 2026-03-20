import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase";
import { getUser } from "@core/auth";
import type { Category } from "@/core/database/schema";
import { requireNonDemo, requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function GET(_request: NextRequest) {
  try {
    // Check if the current user is an admin
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const supabase = await createServerClient();

    // Get categories first
    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 },
      );
    }

    const { data: pharmacyMeds } = await supabase
      .from("pharmacy_medications")
      .select("category, pharmacy_id, pharmacies(name)")
      .not("category", "is", null);

    const categoriesWithCounts = (categories || []).map((category: Category) => {
      const matchingMeds = (pharmacyMeds || []).filter(
        (m: { category: string | null }) => m.category === category.name,
      );

      const pharmacyMap = new Map<string, { pharmacy_name: string; count: number }>();
      for (const med of matchingMeds) {
        const pid = med.pharmacy_id;
        const pharmacyData = (med as unknown as { pharmacies: { name: string } | { name: string }[] | null }).pharmacies;
        const pname = Array.isArray(pharmacyData) ? pharmacyData[0]?.name : pharmacyData?.name || "Unknown";
        if (pharmacyMap.has(pid)) {
          pharmacyMap.get(pid)!.count++;
        } else {
          pharmacyMap.set(pid, { pharmacy_name: pname, count: 1 });
        }
      }

      return {
        ...category,
        medication_count: matchingMeds.length,
        pharmacy_counts: Array.from(pharmacyMap.values()),
      };
    });

    return NextResponse.json({
      categories: categoriesWithCounts,
    });
  } catch (error) {
    console.error("Error in categories GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const platformCheck = await requirePlatformAdmin();
    if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const supabase = await createServerClient();

    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if name already exists
    const { data: existingCategoryByName } = await supabase
      .from("categories")
      .select("id")
      .eq("name", body.name)
      .single();

    if (existingCategoryByName) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 400 },
      );
    }

    // Check if slug already exists
    const { data: existingCategoryBySlug } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", body.slug)
      .single();

    if (existingCategoryBySlug) {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 400 },
      );
    }

    // Get the next display order
    const { data: lastCategory } = await supabase
      .from("categories")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = lastCategory ? lastCategory.display_order + 1 : 0;

    // Create category with default values
    const { data: category, error } = await supabase
      .from("categories")
      .insert({
        name: body.name,
        slug: body.slug,
        display_order: nextDisplayOrder,
        is_active: true,
        ...(body.description ? { description: body.description } : {}),
        ...(body.color ? { color: body.color } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);

      // Handle specific database errors
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json(
          { error: "A category with this name or slug already exists" },
          { status: 400 },
        );
      } else if (error.code === "23502") {
        // Not null violation
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 },
        );
      } else if (error.code === "22001") {
        // String data right truncation
        return NextResponse.json(
          { error: "Category name or slug is too long" },
          { status: 400 },
        );
      }

      // Return generic error for other cases
      return NextResponse.json(
        {
          error:
            "Failed to create category. Please check your input and try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error in categories POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
