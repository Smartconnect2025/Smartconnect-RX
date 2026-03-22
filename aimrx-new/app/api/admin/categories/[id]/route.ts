import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase";
import { getUser } from "@core/auth";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

async function verifyCategoryAccessForPharmacyAdmin(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  categoryId: string,
  pharmacyId: string,
): Promise<boolean> {
  const { data: cat } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .single();
  if (!cat) return false;

  const { data: meds } = await supabase
    .from("pharmacy_medications")
    .select("id")
    .eq("category", cat.name)
    .eq("pharmacy_id", pharmacyId)
    .limit(1);

  return !!(meds && meds.length > 0);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;
    const body = await request.json();
    const supabase = await createServerClient();

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      const hasAccess = await verifyCategoryAccessForPharmacyAdmin(supabase, id, scope.pharmacyId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
    }

    if (body.slug) {
      const { data: existingCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", body.slug)
        .neq("id", id)
        .single();

      if (existingCategory) {
        return NextResponse.json(
          { error: "Category with this slug already exists" },
          { status: 400 },
        );
      }
    }

    let oldCategoryName: string | null = null;
    if (body.name !== undefined) {
      const { data: existing } = await supabase
        .from("categories")
        .select("name")
        .eq("id", id)
        .single();
      if (existing && existing.name !== body.name) {
        oldCategoryName = existing.name;
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.description !== undefined) updateData.description = body.description;

    const { data: category, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (!error && oldCategoryName && body.name) {
      const { error: cascadeError } = await supabase
        .from("pharmacy_medications")
        .update({ category: body.name })
        .eq("category", oldCategoryName);

      if (cascadeError) {
        console.error("Error cascading category name change to pharmacy_medications:", cascadeError);
      }
    }

    if (error) {
      console.error("Error updating category:", error);
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 },
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error in category PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;
    const supabase = await createServerClient();

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      const hasAccess = await verifyCategoryAccessForPharmacyAdmin(supabase, id, scope.pharmacyId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
    }

    const { data: categoryData } = await supabase
      .from("categories")
      .select("name")
      .eq("id", id)
      .single();

    if (!categoryData) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (categoryData.name) {
      const { error: medsError } = await supabase
        .from("pharmacy_medications")
        .update({ category: null })
        .eq("category", categoryData.name);

      if (medsError) {
        console.error("Error clearing pharmacy_medications category:", medsError);
      }
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ category_id: null })
      .eq("category_id", id);

    if (updateError) {
      console.error("Error updating products:", updateError);
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      console.error("Error deleting category:", error);
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in category DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
