import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import {
  resolvePharmacyBackend,
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
} from "../../_shared/digitalrx-helpers";
import { ensureTrackerRegistered } from "../../_shared/tracking-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabaseAdmin = createAdminClient();

  try {
    const { user, userRole } = await getUser();
    if (!user || !userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin access required" },
        { status: 403 },
      );
    }

    const { id: prescriptionId } = await params;

    // Get prescription
    const { data: prescription, error: prescError } = await supabaseAdmin
      .from("prescriptions")
      .select("id, queue_id, status, tracking_number, pharmacy_id, medication")
      .eq("id", prescriptionId)
      .single();

    if (prescError || !prescription) {
      console.error("Prescription not found:", prescError);
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (!prescription.queue_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No queue ID - prescription may not have been submitted to DigitalRx yet",
        },
        { status: 400 },
      );
    }

    // Resolve pharmacy backend (handles pharmacy_id lookup + default fallback)
    const backend = await resolvePharmacyBackend(
      supabaseAdmin,
      prescription.pharmacy_id,
    );

    if (!backend) {
      console.error("No pharmacy backend found for prescription");
      return NextResponse.json(
        {
          success: false,
          error:
            "Pharmacy backend configuration not found. Please contact support.",
        },
        { status: 404 },
      );
    }

    // Call DigitalRx API
    const apiResult = await fetchDigitalRxStatus(
      backend,
      prescription.queue_id,
    );

    if (!apiResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: apiResult.error,
          ...(apiResult.errorText && { details: apiResult.errorText }),
          ...(apiResult.rawResponse && { details: apiResult.rawResponse }),
        },
        { status: 502 },
      );
    }

    const statusData = apiResult.data;

    // Map status (preserving existing tracking number as fallback)
    const { newStatus, trackingNumber } = mapDigitalRxStatus(
      statusData,
      prescription.status,
      prescription.tracking_number,
    );

    const lastUpdated = statusData.LastUpdated || new Date().toISOString();

    // Update prescription in database
    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        status: newStatus,
        tracking_number: trackingNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    if (trackingNumber) {
      ensureTrackerRegistered(prescriptionId, trackingNumber).catch((err) =>
        console.error("[check-status] EasyPost registration error:", err),
      );
    }

    if (updateError) {
      console.error("Failed to update prescription:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update prescription status in database",
        },
        { status: 500 },
      );
    }

    // Log the successful status check
    await supabaseAdmin.from("system_logs").insert({
      action: "PRESCRIPTION_STATUS_CHECKED",
      details: `Checked status for ${prescription.medication} (Queue ${prescription.queue_id}) - Status: ${newStatus}${trackingNumber ? ` - Tracking: ${trackingNumber}` : ""}`,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      queue_id: prescription.queue_id,
      old_status: prescription.status,
      new_status: newStatus,
      tracking_number: trackingNumber,
      last_updated: lastUpdated,
      changed: prescription.status !== newStatus,
    });
  } catch (error) {
    console.error("Error checking prescription status:", error);

    // Log the error (ignore if logging fails)
    try {
      await supabaseAdmin.from("system_logs").insert({
        action: "PRESCRIPTION_STATUS_CHECK_ERROR",
        details: `Error checking status: ${error instanceof Error ? error.message : String(error)}`,
        status: "error",
      });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while checking prescription status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
