/**
 * Admin Tier Management API
 *
 * Endpoint for admin users to update or delete specific tiers
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { tierName, tierCode, discountPercentage, description } = body;

    // Validate discount percentage if provided
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

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (tierName) updateData.tier_name = tierName;
    if (tierCode) updateData.tier_code = tierCode.toLowerCase().replace(/\s+/g, '');
    if (discountPercentage !== undefined) updateData.discount_percentage = parseFloat(discountPercentage);
    if (description !== undefined) updateData.description = description;
    updateData.updated_at = new Date().toISOString();

    // Try to update in database first
    const { data: dbTier, error: dbError } = await supabase
      .from("tiers")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (dbError) {
      // Check for unique constraint violation
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "A tier with this name or code already exists" },
          { status: 409 },
        );
      }
      // Check for not found (PGRST116 = no rows returned from single())
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const supabase = await createServerClient();

    // First, check if the tier exists in database
    const { error: fetchError } = await supabase
      .from("tiers")
      .select("id")
      .eq("id", params.id)
      .single();

    if (fetchError) {
      // Check for not found (PGRST116 = no rows returned from single())
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

    // Delete the tier
    const { error: dbError } = await supabase
      .from("tiers")
      .delete()
      .eq("id", params.id);

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
