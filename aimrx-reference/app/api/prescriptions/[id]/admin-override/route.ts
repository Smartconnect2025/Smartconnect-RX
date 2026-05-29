import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
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
        { success: false, error: "Provide at least a status or tracking number" },
        { status: 400 },
      );
    }

    const validStatuses = [
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

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: rx, error: rxError } = await supabase
      .from("prescriptions")
      .select("id, status, tracking_number, medication, patient_id, prescriber_id")
      .eq("id", prescriptionId)
      .single();

    if (rxError || !rx) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
    }

    if (trackingNumber !== undefined) {
      updateData.tracking_number = trackingNumber || null;
    }

    const { error: updateError } = await supabase
      .from("prescriptions")
      .update(updateData)
      .eq("id", prescriptionId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Update failed: ${updateError.message}` },
        { status: 500 },
      );
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", rx.patient_id)
      .single();

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

    const changes: string[] = [];
    if (status && status !== rx.status) changes.push(`status: ${rx.status} → ${status}`);
    if (trackingNumber && trackingNumber !== rx.tracking_number) changes.push(`tracking: ${rx.tracking_number || "none"} → ${trackingNumber}`);

    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email || "admin@aimrx.com",
      user_name: `Admin Override`,
      action: "ADMIN_PRESCRIPTION_OVERRIDE",
      details: `Manual override for ${patientName} — ${rx.medication}\n${changes.join("\n")}${note ? `\nNote: ${note}` : ""}`,
      status: "success",
    });

    if (status && trackingNumber && status !== rx.status) {
      sendStatusNotification(supabase, prescriptionId, status, trackingNumber).catch((err) =>
        console.error(`[admin-override] Notification error:`, err)
      );
    }

    return NextResponse.json({
      success: true,
      message: `Prescription updated: ${changes.join(", ")}`,
      changes,
    });
  } catch (error) {
    console.error("[admin-override] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

async function sendStatusNotification(
  supabase: ReturnType<typeof createAdminClient>,
  prescriptionId: string,
  newStatus: string,
  trackingNumber: string,
) {
  const statusMap: Record<string, string> = {
    packed: "pharmacy_processing",
    approved: "pharmacy_processing",
    picked_up: "shipped",
    shipped: "shipped",
    delivered: "delivered",
    ready_for_pickup: "ready_for_pickup",
  };

  const statusType = statusMap[newStatus];
  if (!statusType) return;

  const { data: rx } = await supabase
    .from("prescriptions")
    .select("patient_id, prescriber_id, medication, dosage, pharmacy_id")
    .eq("id", prescriptionId)
    .single();

  if (!rx?.patient_id) return;

  const { data: patient } = await supabase
    .from("patients")
    .select("email, first_name, last_name, phone")
    .eq("id", rx.patient_id)
    .single();

  if (!patient?.email) return;

  const { data: provider } = await supabase
    .from("providers")
    .select("prefix, first_name, last_name")
    .eq("user_id", rx.prescriber_id)
    .single();

  let pharmacyName: string | undefined;
  let pharmacyPhone: string | undefined;
  let pharmacyAddress: string | undefined;
  if (rx.pharmacy_id) {
    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("name, phone, address")
      .eq("id", rx.pharmacy_id)
      .single();
    pharmacyName = pharmacy?.name;
    pharmacyPhone = pharmacy?.phone;
    pharmacyAddress = pharmacy?.address;
  }

  const medication = [rx.medication, rx.dosage].filter(Boolean).join(" ");
  const providerName = provider ? `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}` : "Your Provider";
  const patientName = `${patient.first_name} ${patient.last_name}`;

  const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.aimrx.com";
  const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

  try {
    await fetch(`${APP_URL}/api/payments/send-status-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_KEY || "",
      },
      body: JSON.stringify({
        patientEmail: patient.email,
        patientPhone: patient.phone || undefined,
        patientName,
        medication,
        providerName,
        statusType,
        trackingNumber: trackingNumber || undefined,
        pharmacyName,
        pharmacyPhone,
        pharmacyAddress,
        prescriptionId,
      }),
    });
  } catch (err) {
    console.error(`[admin-override] Status notification error:`, err);
  }
}
