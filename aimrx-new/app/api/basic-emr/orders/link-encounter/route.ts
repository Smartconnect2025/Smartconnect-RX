import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@core/supabase/client";
import { getUser } from "@/core/auth/get-user";

import { orderEncounterService } from "@/features/basic-emr/services/orderEncounterService";
import { flowFactory } from "@/features/basic-emr/services/flowFactory";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, orderData } = await request.json();

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
        { error: "Only providers can create encounters from orders" },
        { status: 403 },
      );
    }

    if (orderId) {
      // If orderId is provided, get existing order from main orders table
      const { data: existingOrder, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_line_items(name, product_id)
        `,
        )
        .eq("id", orderId)
        .single();

      if (orderError || !existingOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      // Check if encounter already exists for this order
      const { data: existingEncounter } = await supabase
        .from("encounters")
        .select("id")
        .eq("order_id", orderId)
        .single();

      if (existingEncounter) {
        return NextResponse.json({
          success: true,
          encounterId: existingEncounter.id,
          orderId: orderId,
          message: "Encounter already exists for this order",
        });
      }

      // Use flowFactory to create appropriate flow for this order
      const orderType = determineOrderTypeFromLineItems(
        existingOrder.order_line_items || [],
      );

      // Get provider details if user is a provider
      const { data: providerData } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const flowResult = await flowFactory.createOrderFlow({
        orderId: existingOrder.id,
        patientId: existingOrder.user_id,
        orderType,
        userId: user.id,
        providerId: providerData?.id,
      });

      if (flowResult.success) {
        return NextResponse.json({
          success: true,
          encounterId: flowResult.encounterId,
          orderId: orderId,
          flowType: flowResult.flowType,
          message: `${flowResult.flowType} encounter created successfully`,
        });
      } else {
        return NextResponse.json({ error: flowResult.error }, { status: 500 });
      }
    } else if (orderData) {
      // If orderData is provided, create new order first
      // Note: We need to create the encounter first, then the order
      // because encounter_id is required in emr_orders table

      // Get provider details for encounter creation
      const { data: providerData } = await supabase
        .from("providers")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .single();

      if (!providerData) {
        return NextResponse.json(
          { error: "Provider information not found" },
          { status: 404 },
        );
      }

      // Create encounter first
      const encounterData = {
        patient_id: orderData.patientId,
        title: `Order Review: ${orderData.title}`,
        encounter_date: new Date().toISOString(),
        encounter_type: "consultation",
        business_type: "order_based",
        provider_name: `${providerData.first_name} ${providerData.last_name}`,
        provider_id: providerData.id,
        status: "upcoming",
      };

      const { data: newEncounter, error: encounterError } = await supabase
        .from("encounters")
        .insert(encounterData)
        .select()
        .single();

      if (encounterError) {
        console.error("Error creating encounter:", encounterError);
        return NextResponse.json(
          { error: "Failed to create encounter" },
          { status: 500 },
        );
      }

      // Now create the order with the encounter_id
      const { data: newOrder, error: orderError } = await supabase
        .from("emr_orders")
        .insert({
          patient_id: orderData.patientId,
          encounter_id: newEncounter.id,
          ordered_by: user.id,
          order_type: orderData.type,
          title: orderData.title,
          details: orderData.details,
          ordered_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        return NextResponse.json(
          { error: "Failed to create order" },
          { status: 500 },
        );
      }

      // Update the encounter with the order_id
      await supabase
        .from("encounters")
        .update({ order_id: newOrder.id })
        .eq("id", newEncounter.id);

      return NextResponse.json({
        success: true,
        encounterId: newEncounter.id,
        orderId: newOrder.id,
        message: "Order and encounter created successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Either orderId or orderData is required" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error linking order to encounter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 },
      );
    }

    // Check if encounter already exists for this order
    const existingEncounter =
      await orderEncounterService.getEncounterByOrderId(orderId);

    return NextResponse.json({
      success: true,
      hasEncounter: !!existingEncounter,
      encounterId: existingEncounter?.id || null,
    });
  } catch (error) {
    console.error("Error checking order encounter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Determine order type from line items (helper function)
 */
function determineOrderTypeFromLineItems(
  lineItems: { name?: string }[],
): string {
  for (const item of lineItems) {
    const itemName = item.name?.toLowerCase() || "";

    if (itemName.includes("trt") || itemName.includes("testosterone")) {
      return "TRT";
    }
    if (itemName.includes("weight loss")) {
      return "weight_loss";
    }
    if (itemName.includes("controlled")) {
      return "controlled_medication";
    }
    if (itemName.includes("lab")) {
      return "lab_test";
    }
  }

  return "medication"; // Default to async medication
}
