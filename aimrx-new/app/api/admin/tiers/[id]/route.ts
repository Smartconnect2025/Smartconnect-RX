import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const body = await request.json();
    const { tierName, discountPercentage, description } = body;

    if (discountPercentage !== undefined) {
      const discount = parseFloat(discountPercentage);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        return NextResponse.json(
          { error: "Discount percentage must be between 0 and 100" },
          { status: 400 },
        );
      }
    }

    const supabase = await createServerClient();
    let scopedPharmacyId: string | null = null;

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      scopedPharmacyId = scope.pharmacyId;
    }

    const updateData: Record<string, unknown> = {};
    if (tierName) updateData.tier_name = tierName;
    if (discountPercentage !== undefined) updateData.discount_percentage = parseFloat(discountPercentage);
    if (description !== undefined) updateData.description = description;
    updateData.updated_at = new Date().toISOString();

    let updateQuery = supabase
      .from("tiers")
      .update(updateData)
      .eq("id", params.id);

    if (scopedPharmacyId) {
      updateQuery = updateQuery.eq("pharmacy_id", scopedPharmacyId);
    }

    const { data: dbTier, error: dbError } = await updateQuery
      .select()
      .single();

    if (dbError) {
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "A tier with this name already exists" },
          { status: 409 },
        );
      }
      if (dbError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Tier not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to update tier. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      tier: dbTier,
      message: "Tier updated successfully",
    });
  } catch (error) {
    console.error("Error updating tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const supabase = await createServerClient();
    let scopedPharmacyId: string | null = null;

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      scopedPharmacyId = scope.pharmacyId;
    }

    let existsQuery = supabase
      .from("tiers")
      .select("id")
      .eq("id", params.id);

    if (scopedPharmacyId) {
      existsQuery = existsQuery.eq("pharmacy_id", scopedPharmacyId);
    }

    const { error: fetchError } = await existsQuery.single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Tier not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to delete tier. Please try again." },
        { status: 500 },
      );
    }

    let deleteQuery = supabase
      .from("tiers")
      .delete()
      .eq("id", params.id);

    if (scopedPharmacyId) {
      deleteQuery = deleteQuery.eq("pharmacy_id", scopedPharmacyId);
    }

    const { error: dbError } = await deleteQuery;

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to delete tier. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tier deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
