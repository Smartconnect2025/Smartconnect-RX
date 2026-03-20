/**
 * Admin Tiers API
 *
 * Endpoint for admin users to manage tier levels and discount percentages
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { requireNonDemo, requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function GET() {
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

    // Try to fetch from database first
    const { data: dbTiers, error: dbError } = await supabase
      .from("tiers")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to load tiers. Please try again." },
        { status: 500 }
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
    const platformCheck = await requirePlatformAdmin();
    if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { tierName, tierCode, discountPercentage, description } = body;

    // Validate required fields
    if (!tierName || !tierCode || discountPercentage === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: tierName, tierCode, discountPercentage" },
        { status: 400 },
      );
    }

    // Validate discount percentage
    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      return NextResponse.json(
        { error: "Discount percentage must be between 0 and 100" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Try to create in database first
    const { data: dbTier, error: dbError } = await supabase
      .from("tiers")
      .insert({
        tier_name: tierName,
        tier_code: tierCode.toLowerCase().replace(/\s+/g, ''),
        discount_percentage: discount,
        description: description || null,
      })
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
