import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { fetchAndApplyTracking } from "@/app/api/prescriptions/_shared/tracking-sync";

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prescriptionId } = body;

    if (!prescriptionId) {
      return NextResponse.json({ error: "Missing prescriptionId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: rx, error } = await supabase
      .from("prescriptions")
      .select("id, tracking_number, easypost_tracker_id, status, fedex_status, estimated_delivery, prescriber_id")
      .eq("id", prescriptionId)
      .single();

    if (!error && rx && userRole !== "admin" && userRole !== "super_admin") {
      if (rx.prescriber_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (error || !rx) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    if (!rx.tracking_number) {
      return NextResponse.json({
        synced: false,
        message: "No tracking number",
        status: rx.status,
      });
    }

    if (rx.status === "delivered") {
      return NextResponse.json({
        synced: false,
        message: "Already delivered",
        status: rx.status,
        fedexStatus: rx.fedex_status,
        estimatedDelivery: rx.estimated_delivery,
      });
    }

    const result = await fetchAndApplyTracking(
      rx.id,
      rx.tracking_number,
      rx.easypost_tracker_id,
    );

    if (result.updated) {
      const { data: updated } = await supabase
        .from("prescriptions")
        .select("status, fedex_status, estimated_delivery")
        .eq("id", prescriptionId)
        .single();

      return NextResponse.json({
        synced: true,
        status: updated?.status || rx.status,
        fedexStatus: updated?.fedex_status,
        estimatedDelivery: updated?.estimated_delivery,
      });
    }

    return NextResponse.json({
      synced: false,
      message: result.error || "No changes",
      status: rx.status,
      fedexStatus: rx.fedex_status,
      estimatedDelivery: rx.estimated_delivery,
    });
  } catch (error) {
    console.error("[sync-tracking] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
