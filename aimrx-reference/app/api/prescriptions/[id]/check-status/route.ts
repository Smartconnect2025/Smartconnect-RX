import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

export async function POST(
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
    const supabaseAdmin = createAdminClient();

    const { data: prescription } = await supabaseAdmin
      .from("prescriptions")
      .select("id, queue_id, status, tracking_number, medication, updated_at")
      .eq("id", prescriptionId)
      .single();

    if (!prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    const { data: lastWebhook } = await supabaseAdmin
      .from("system_logs")
      .select("created_at, details, status")
      .eq("action", "WEBHOOK_STATUS_UPDATE")
      .eq("queue_id", prescription.queue_id || "")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      message: "DigitalRx API polling is disabled. Status updates come via webhook only.",
      prescription: {
        id: prescription.id,
        queue_id: prescription.queue_id,
        status: prescription.status,
        tracking_number: prescription.tracking_number,
        medication: prescription.medication,
        last_updated: prescription.updated_at,
      },
      last_webhook: lastWebhook ? {
        received_at: lastWebhook.created_at,
        details: lastWebhook.details,
        result: lastWebhook.status,
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
