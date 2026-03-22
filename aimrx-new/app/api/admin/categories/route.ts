import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase";
import { getUser } from "@core/auth";
import type { Category } from "@/core/database/schema";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function GET(request: NextRequest) {
  try {
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

    const isSuperAdmin = userRole === "super_admin";
    let pharmacyId: string | null = null;

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      pharmacyId = scope.pharmacyId;
    } else {
      pharmacyId = request.nextUrl.searchParams.get("pharmacyId") || null;
    }

    const supabase = await createServerClient();

    let query = supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: categories, error: categoriesError } = await query;

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 },
      );
    }

    let medsQuery = supabase
      .from("pharmacy_medications")
      .select("category, pharmacy_id, pharmacies(name)")
      .not("category", "is", null);

    if (pharmacyId) {
      medsQuery = medsQuery.eq("pharmacy_id", pharmacyId);
    }

    const { data: pharmacyMeds } = await medsQuery;

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

    const isSuperAdmin = userRole === "super_admin";
    let pharmacyId: string | null = null;

    const body = await request.json();

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      pharmacyId = scope.pharmacyId;
    } else {
      pharmacyId = body.pharmacy_id || null;
      if (!pharmacyId) {
        return NextResponse.json(
          { error: "Pharmacy selection is required" },
          { status: 400 },
        );
      }
    }

    const supabase = await createServerClient();

    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { data: existingCategoryByName } = await supabase
      .from("categories")
      .select("id")
      .eq("name", body.name)
      .eq("pharmacy_id", pharmacyId!)
      .single();

    if (existingCategoryByName) {
      return NextResponse.json(
        { error: "A category with this name already exists for this pharmacy" },
        { status: 400 },
      );
    }

    const { data: existingCategoryBySlug } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", body.slug)
      .eq("pharmacy_id", pharmacyId!)
      .single();

    if (existingCategoryBySlug) {
      return NextResponse.json(
        { error: "A category with this slug already exists for this pharmacy" },
        { status: 400 },
      );
    }

    const { data: lastCategory } = await supabase
      .from("categories")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = lastCategory ? lastCategory.display_order + 1 : 0;

    const { data: category, error } = await supabase
      .from("categories")
      .insert({
        name: body.name,
        slug: body.slug,
        display_order: nextDisplayOrder,
        is_active: true,
        pharmacy_id: pharmacyId,
        ...(body.description ? { description: body.description } : {}),
        ...(body.color ? { color: body.color } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A category with this name or slug already exists" },
          { status: 400 },
        );
      } else if (error.code === "23502") {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 },
        );
      } else if (error.code === "22001") {
        return NextResponse.json(
          { error: "Category name or slug is too long" },
          { status: 400 },
        );
      }

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
