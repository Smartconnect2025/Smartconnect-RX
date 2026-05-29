import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";

/**
 * Update ONLY the shipping fee for a pharmacy.
 *
 * This endpoint is intentionally narrow: it accepts exactly one field
 * (`shipping_fee_cents`) and writes only that column. It exists separately
 * from the general pharmacy PUT endpoint so the admin shipping UI cannot
 * touch any other pharmacy fields (profile data, API keys, etc.) under any
 * circumstance.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerClient();

  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    const pharmacyId = params.id;
    const body = await request.json();
    const raw = body?.shipping_fee_cents;

    if (raw === undefined || raw === null || raw === "") {
      return NextResponse.json(
        { success: false, error: "shipping_fee_cents is required" },
        { status: 400 },
      );
    }

    const cents = Number(raw);
    if (!Number.isFinite(cents) || cents < 0 || cents > 100000) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shipping fee must be a non-negative whole-cent value up to $1000.",
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("pharmacies")
      .update({ shipping_fee_cents: Math.round(cents) })
      .eq("id", pharmacyId);

    if (updateError) {
      console.error("Error updating pharmacy shipping fee:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update shipping fee",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      shipping_fee_cents: Math.round(cents),
    });
  } catch (error) {
    console.error("Error in update shipping fee:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update shipping fee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
