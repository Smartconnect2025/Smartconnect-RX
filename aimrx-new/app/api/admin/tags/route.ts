import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

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
      if (scope.isPharmacyAdmin && !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      if (scope.isPharmacyAdmin && scope.pharmacyId) {
        pharmacyId = scope.pharmacyId;
      }
    } else {
      pharmacyId = request.nextUrl.searchParams.get("pharmacyId") || null;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const supabase = createClient();

    let countQuery = supabase
      .from("tags")
      .select("*", { count: "exact", head: true });

    if (search) {
      countQuery = countQuery.ilike("name", `%${search}%`);
    }
    if (pharmacyId) {
      countQuery = countQuery.eq("pharmacy_id", pharmacyId);
    }

    const { count } = await countQuery;

    let tagsQuery = supabase.from("tags").select("*");

    if (search) {
      tagsQuery = tagsQuery.ilike("name", `%${search}%`);
    }
    if (pharmacyId) {
      tagsQuery = tagsQuery.eq("pharmacy_id", pharmacyId);
    }

    const { data: tags, error } = await tagsQuery
      .order("usage_count", { ascending: false })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching tags:", error);
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tags: tags || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in tags GET:", error);
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
    const { name } = body;

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (scope.isPharmacyAdmin && !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      if (scope.isPharmacyAdmin && scope.pharmacyId) {
        pharmacyId = scope.pharmacyId;
      }
    } else {
      pharmacyId = body.pharmacy_id || null;
      if (!pharmacyId) {
        return NextResponse.json(
          { error: "Pharmacy selection is required" },
          { status: 400 },
        );
      }
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Tag name must be 50 characters or less" },
        { status: 400 },
      );
    }

    const supabase = createClient();

    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("name", trimmedName)
      .eq("pharmacy_id", pharmacyId!)
      .single();

    if (existingTag) {
      return NextResponse.json(
        { error: "A tag with this name already exists for this pharmacy" },
        { status: 400 },
      );
    }

    const slug = generateSlug(trimmedName);

    const { data, error } = await supabase
      .from("tags")
      .insert({
        name: trimmedName,
        slug,
        usage_count: 0,
        pharmacy_id: pharmacyId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      return NextResponse.json(
        { error: "Failed to create tag" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      tag: data,
      message: "Tag created successfully",
    });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
