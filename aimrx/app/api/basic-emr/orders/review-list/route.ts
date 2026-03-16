import { NextResponse } from "next/server";
import { createClient } from "@core/supabase/client";
import { getUser } from "@/core/auth/get-user";

export async function GET() {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a provider
    const supabase = createClient();
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (
      roleError ||
      !userRole ||
      (userRole.role !== "provider" && userRole.role !== "admin")
    ) {
      return NextResponse.json(
        { error: "Only providers can access order review" },
        { status: 403 },
      );
    }

    // Get orders that need review (pending status)
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        patients!orders_user_id_fkey(
          id,
          first_name,
          last_name
        ),
        encounters!encounters_order_id_fkey(
          id,
          appointment_id,
          status,
          business_type
        ),
        order_line_items(
          name,
          product_id
        )
      `,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders for review:", error);
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
          orderType = "TRT"; // Default sync order type
        } else if (encounter.business_type === "order_based_async") {
          orderType = "medication"; // Default async order type
        }
      } else if (order.order_line_items && order.order_line_items.length > 0) {
        // If no encounter, determine from line items
        const itemNames = order.order_line_items.map(
          (item: { name?: string }) => item.name?.toLowerCase() || "",
        );

        // Debug logging

        if (
          itemNames.some(
            (name: string) =>
              name.includes("trt") || name.includes("testosterone"),
          )
        ) {
          orderType = "TRT";
        } else if (
          itemNames.some(
            (name: string) =>
              name.includes("weight loss") ||
              name.includes("weight-loss") ||
              name.includes("weightloss") ||
              name.includes("semaglutide") ||
              name.includes("ozempic") ||
              name.includes("wegovy"),
          )
        ) {
          orderType = "weight_loss";
        } else if (
          itemNames.some(
            (name: string) =>
              name.includes("controlled") ||
              name.includes("mental health") ||
              name.includes("adhd") ||
              name.includes("anxiety") ||
              name.includes("depression"),
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
        title: `Order #${order.id.slice(0, 8)}`, // Generate a title from order ID
        details: `Order placed on ${new Date(order.created_at).toLocaleDateString()}`,
        order_type: orderType,
        status: order.status,
        ordered_at: order.created_at,
        patient_id: order.patients?.id || order.user_id, // Use patient ID if available, fallback to user_id
        patient_name: order.patients
          ? `${order.patients.first_name} ${order.patients.last_name}`
          : "Unknown Patient",
        encounter_id: encounter?.id,
        appointment_id: encounter?.appointment_id,
        appointment_status:
          encounter?.status === "completed"
            ? "completed"
            : encounter?.appointment_id
              ? "scheduled"
              : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedOrders,
    });
  } catch (error) {
    console.error("Error in review-list API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
