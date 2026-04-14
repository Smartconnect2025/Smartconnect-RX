import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { fetchAndApplyTracking } from "../_shared/tracking-sync";

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { prescriptionId } = body as { prescriptionId: string };

    if (!prescriptionId) {
      return NextResponse.json(
        { success: false, error: "prescriptionId is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: prescription, error: findErr } = await supabase
      .from("prescriptions")
      .select("id, tracking_number, easypost_tracker_id, status, prescriber_id, pharmacy_id")
      .eq("id", prescriptionId)
      .single();

    if (findErr || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (userRole === "provider") {
      if (prescription.prescriber_id !== user.id) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 },
        );
      }
    } else if (userRole === "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .single();

      if (!pharmacyAdmin || pharmacyAdmin.pharmacy_id !== prescription.pharmacy_id) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 },
        );
      }
    }

    if (!prescription.tracking_number) {
      return NextResponse.json(
        { success: false, error: "No tracking number on this prescription" },
        { status: 400 },
      );
    }

    if (prescription.status === "delivered") {
      return NextResponse.json({
        success: true,
        message: "Already delivered — no sync needed",
        updated: false,
      });
    }

    const result = await fetchAndApplyTracking(
      prescriptionId,
      prescription.tracking_number,
      prescription.easypost_tracker_id,
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: result.updated ? "Tracking data updated" : "No changes from carrier",
    });
  } catch (error) {
    console.error("[sync-tracking] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
