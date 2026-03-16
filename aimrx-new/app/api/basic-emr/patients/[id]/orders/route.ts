import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@core/supabase/client";
import { getUser } from "@/core/auth/get-user";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const patientId = id;

    const supabase = createClient();

    // First, get the patient to find their user_id
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("user_id")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Get all orders for this patient (through user_id)
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        encounters!encounters_order_id_fkey(
          id,
          appointment_id,
          status,
          business_type
        ),
        order_line_items(
          name,
          product_id,
          price
        )
      `,
      )
      .eq("user_id", patient.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching patient orders:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 },
      );
    }

    // Transform the data
    const transformedOrders = orders.map((order) => {
      const encounter = order.encounters?.[0]; // Get the first encounter if it exists

      // Determine order type from line items or business type
      let orderType = "medication"; // Default

      if (encounter?.business_type) {
        // If encounter exists, use business type
        if (encounter.business_type === "order_based_sync") {
          orderType = "controlled_medication"; // Default sync order type
        } else if (encounter.business_type === "order_based_async") {
          orderType = "medication"; // Default async order type
        }
      } else if (order.order_line_items && order.order_line_items.length > 0) {
        // If no encounter, determine from line items
        const itemNames = order.order_line_items.map(
          (item: { name?: string }) => item.name?.toLowerCase() || "",
        );

        if (
          itemNames.some(
            (name: string) =>
              name.includes("trt") || name.includes("testosterone"),
          )
        ) {
          orderType = "controlled_medication";
        } else if (
          itemNames.some(
            (name: string) =>
              name.includes("weight loss") || name.includes("controlled"),
          )
        ) {
          orderType = "controlled_medication";
        } else if (itemNames.some((name: string) => name.includes("lab"))) {
          orderType = "lab_test";
        } else {
          orderType = "medication";
        }
      }

      return {
        id: order.id,
        title: `Order #${order.id.slice(0, 8)}`,
        details: `Order placed on ${new Date(order.created_at).toLocaleDateString()}`,
        order_type: orderType,
        status: order.status,
        ordered_at: order.created_at,
        patient_id: patientId,
        patient_name: "Patient", // We could fetch this if needed
        encounter_id: encounter?.id,
        appointment_id: encounter?.appointment_id,
        appointment_status:
          encounter?.status === "completed"
            ? "completed"
            : encounter?.appointment_id
              ? "scheduled"
              : undefined,
        order_line_items: order.order_line_items,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedOrders,
    });
  } catch (error) {
    console.error("Error in patient orders API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
