import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

const STATUS_PROGRESSION = {
  submitted: "billing",
  billing: "approved",
  approved: "processing",
  processing: "shipped",
  shipped: "delivered",
  delivered: "delivered",
};

const generateTrackingNumber = () => {
  const prefix = "1Z";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let tracking = prefix;
  for (let i = 0; i < 16; i++) {
    tracking += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tracking;
};

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { prescription_id, action } = body;

    if (!prescription_id) {
      return NextResponse.json(
        { success: false, error: "prescription_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: prescription, error: fetchError } = await supabase
      .from("prescriptions")
      .select("id, status, tracking_number")
      .eq("id", prescription_id)
      .single();

    if (fetchError || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    let newStatus = prescription.status;
    let trackingNumber = prescription.tracking_number;

    if (action === "advance") {
      const currentStatus = prescription.status.toLowerCase();
      newStatus = STATUS_PROGRESSION[currentStatus as keyof typeof STATUS_PROGRESSION] || currentStatus;

      if (newStatus === "shipped" && !trackingNumber) {
        trackingNumber = generateTrackingNumber();
      }
    } else if (action === "reset") {
      newStatus = "submitted";
      trackingNumber = null;
    }

    const { error: updateError } = await supabase
      .from("prescriptions")
      .update({
        status: newStatus,
        tracking_number: trackingNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescription_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update prescription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        prescription_id,
        old_status: prescription.status,
        new_status: newStatus,
        tracking_number: trackingNumber,
      },
    });
  } catch (error) {
    console.error("Test status update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { count = 1 } = body;

    const supabase = createAdminClient();

    const { data: prescriptions, error: fetchError } = await supabase
      .from("prescriptions")
      .select("id, status, tracking_number")
      .neq("status", "delivered")
      .order("submitted_at", { ascending: false })
      .limit(count);

    if (fetchError || !prescriptions || prescriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No prescriptions found to advance" },
        { status: 404 }
      );
    }

    const updates = [];

    for (const prescription of prescriptions) {
      const currentStatus = prescription.status.toLowerCase();
      const newStatus = STATUS_PROGRESSION[currentStatus as keyof typeof STATUS_PROGRESSION] || currentStatus;

      let trackingNumber = prescription.tracking_number;
      if (newStatus === "shipped" && !trackingNumber) {
        trackingNumber = generateTrackingNumber();
      }

      await supabase
        .from("prescriptions")
        .update({
          status: newStatus,
          tracking_number: trackingNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prescription.id);

      updates.push({
        prescription_id: prescription.id,
        old_status: prescription.status,
        new_status: newStatus,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_count: updates.length,
        updates,
      },
    });
  } catch (error) {
    console.error("Batch test status update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
