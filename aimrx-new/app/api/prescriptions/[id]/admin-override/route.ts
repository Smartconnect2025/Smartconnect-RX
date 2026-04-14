import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

const VALID_STATUSES = [
  "pending_payment",
  "payment_received",
  "submitted",
  "packed",
  "approved",
  "picked_up",
  "shipped",
  "delivered",
  "ready_for_pickup",
  "cancelled",
];

const STATUS_TO_EMAIL_TYPE: Record<string, string> = {
  packed: "pharmacy_processing",
  approved: "pharmacy_processing",
  picked_up: "shipped",
  shipped: "shipped",
  delivered: "delivered",
  ready_for_pickup: "ready_for_pickup",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();
    if (!user || !userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin access required" },
        { status: 403 },
      );
    }

    const { id: prescriptionId } = await params;
    const body = await request.json();
    const { status, trackingNumber, note } = body as {
      status?: string;
      trackingNumber?: string;
      note?: string;
    };

    if (!status && !trackingNumber) {
      return NextResponse.json(
        { success: false, error: "Must provide at least a status or tracking number" },
        { status: 400 },
      );
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${status}. Valid: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: prescription, error: findErr } = await supabase
      .from("prescriptions")
      .select("id, status, tracking_number, queue_id, medication, pharmacy_id, patient_id, patients(first_name, last_name, email)")
      .eq("id", prescriptionId)
      .single();

    if (findErr || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (userRole === "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .single();

      if (!pharmacyAdmin || pharmacyAdmin.pharmacy_id !== prescription.pharmacy_id) {
        return NextResponse.json(
          { success: false, error: "Access denied — prescription not assigned to your pharmacy" },
          { status: 403 },
        );
      }
    }

    const oldStatus = prescription.status;
    const oldTracking = prescription.tracking_number;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
    }
    if (trackingNumber !== undefined) {
      updateData.tracking_number = trackingNumber;
    }

    const { error: updateErr } = await supabase
      .from("prescriptions")
      .update(updateData)
      .eq("id", prescriptionId);

    if (updateErr) {
      console.error("[admin-override] Update failed:", updateErr.message);
      return NextResponse.json(
        { success: false, error: "Failed to update prescription" },
        { status: 500 },
      );
    }

    const changes: string[] = [];
    if (status && status !== oldStatus) changes.push(`Status: ${oldStatus} → ${status}`);
    if (trackingNumber !== undefined && trackingNumber !== oldTracking) {
      changes.push(`Tracking: ${oldTracking || "none"} → ${trackingNumber || "none"}`);
    }

    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email || "",
      user_name: (user as Record<string, unknown>).user_metadata
        ? ((user as Record<string, unknown>).user_metadata as Record<string, string>)?.full_name || user.email || "Admin"
        : user.email || "Admin",
      action: "ADMIN_PRESCRIPTION_OVERRIDE",
      details: `${changes.join("; ")}${note ? ` — Note: ${note}` : ""}`,
      queue_id: prescription.queue_id,
      status: "success",
    });

    const effectiveStatus = status || oldStatus;
    if (status && status !== oldStatus) {
      const emailStatusType = STATUS_TO_EMAIL_TYPE[effectiveStatus];
      if (emailStatusType) {
        const patient = Array.isArray(prescription.patients)
          ? prescription.patients[0]
          : prescription.patients;
        const patientEmail = (patient as Record<string, unknown>)?.email as string | null;

        if (patientEmail) {
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
            const internalKey = process.env.INTERNAL_API_KEY || "";

            await fetch(`${siteUrl}/api/payments/send-status-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-key": internalKey,
              },
              body: JSON.stringify({
                prescriptionId,
                statusType: emailStatusType,
                trackingNumber: trackingNumber || oldTracking || undefined,
              }),
            });
          } catch (emailErr) {
            console.error("[admin-override] Status email failed:", emailErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Prescription updated successfully",
      changes,
    });
  } catch (error) {
    console.error("[admin-override] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
