import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
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
      .from("tiers")
      .select("*")
      .order("created_at", { ascending: false });

    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: dbTiers, error: dbError } = await query;

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to load tiers. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tiers: dbTiers || [],
      total: dbTiers?.length || 0,
    });
  } catch (error) {
    console.error("Error listing tiers:", error);
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
    const { tierName, tierCode, discountPercentage, description } = body;

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

    if (!tierName || !tierCode || discountPercentage === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: tierName, tierCode, discountPercentage" },
        { status: 400 },
      );
    }

    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      return NextResponse.json(
        { error: "Discount percentage must be between 0 and 100" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    const { data: dbTier, error: dbError } = await supabase
      .from("tiers")
      .insert({
        tier_name: tierName,
        tier_code: tierCode.toLowerCase().replace(/\s+/g, ""),
        discount_percentage: discount,
        description: description || null,
        pharmacy_id: pharmacyId,
      })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "A tier with this name or code already exists" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Failed to create tier. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      tier: dbTier,
      message: "Tier created successfully",
    });
  } catch (error) {
    console.error("Error creating tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
