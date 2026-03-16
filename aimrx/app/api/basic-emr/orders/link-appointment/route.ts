import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { createServerClient } from "@/core/supabase/server";
import { appointmentOrderLinkingService } from "@/features/basic-emr/services/appointmentOrderLinkingService";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appointmentId, orderId, orderType } = await request.json();

    if (!appointmentId || !orderId) {
      return NextResponse.json(
        { error: "Appointment ID and Order ID are required" },
        { status: 400 },
      );
    }

    // Create server-side Supabase client for database access
    const supabase = await createServerClient();

    // Get appointment data
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        `
        *,
        provider:providers(*)
      `,
      )
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("Appointment error:", appointmentError);
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    // Get order data
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order error:", orderError);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify that the appointment and order belong to the same user
    // We need to check if the appointment's patient_id corresponds to a patient record
    // that has the same user_id as the order

    const { data: patientRecord, error: patientRecordError } = await supabase
      .from("patients")
      .select("user_id")
      .eq("id", appointment.patient_id)
      .single();

    if (patientRecordError || !patientRecord) {
      console.error("Patient record error:", patientRecordError);
      return NextResponse.json(
        { error: "Patient record not found for appointment" },
        { status: 404 },
      );
    }

    if (patientRecord.user_id !== order.user_id) {

      // Check if there's already a patient record for the order user
      const { data: orderUserPatient, error: orderUserPatientError } =
        await supabase
          .from("patients")
          .select("id")
          .eq("user_id", order.user_id)
          .single();

      if (orderUserPatientError && orderUserPatientError.code === "PGRST116") {
        // No patient record exists for the order user, create one
        const { data: newPatient, error: createPatientError } = await supabase
          .from("patients")
          .insert([
            {
              user_id: order.user_id,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select("id")
          .single();

        if (createPatientError || !newPatient) {
          console.error(
            "Error creating patient record for order user:",
            createPatientError,
          );
          return NextResponse.json(
            { error: "Failed to create patient record for order user" },
            { status: 500 },
          );
        }

        // Update the appointment to use the correct patient ID
        const { error: updateAppointmentError } = await supabase
          .from("appointments")
          .update({ patient_id: newPatient.id })
          .eq("id", appointmentId);

        if (updateAppointmentError) {
          console.error(
            "Error updating appointment patient ID:",
            updateAppointmentError,
          );
          return NextResponse.json(
            { error: "Failed to update appointment patient ID" },
            { status: 500 },
          );
        }

        // Update the appointment object for further processing
        appointment.patient_id = newPatient.id;
      } else if (orderUserPatientError) {
        console.error(
          "Error checking for order user patient:",
          orderUserPatientError,
        );
        return NextResponse.json(
          { error: "Failed to verify patient record for order user" },
          { status: 500 },
        );
      } else if (orderUserPatient) {
        // Patient record exists for order user, update the appointment
        const { error: updateAppointmentError } = await supabase
          .from("appointments")
          .update({ patient_id: orderUserPatient.id })
          .eq("id", appointmentId);

        if (updateAppointmentError) {
          console.error(
            "Error updating appointment patient ID:",
            updateAppointmentError,
          );
          return NextResponse.json(
            { error: "Failed to update appointment patient ID" },
            { status: 500 },
          );
        }

        // Update the appointment object for further processing
        appointment.patient_id = orderUserPatient.id;
      }
    }

    // At this point, we've ensured the appointment has the correct patient_id
    // that matches the order's user_id

    // Link appointment to order using the linking service

    const linkResult =
      await appointmentOrderLinkingService.linkAppointmentToOrder(
        {
          id: appointment.id,
          reference: appointment.id,
          patientId: appointment.patient_id, // This now matches the order user
          providerId: appointment.provider_id,
          appointmentDate: appointment.datetime,
          title: appointment.reason || "Appointment",
          status: "scheduled",
        },
        {
          id: order.id,
          patientId: appointment.patient_id, // Use the corrected patient ID
          orderType: orderType || "sync",
          title: `Order #${order.id.slice(0, 8)}`,
          status: order.status,
        },
        user.id,
      );


    if (linkResult.success) {
      return NextResponse.json({
        success: true,
        encounterId: linkResult.encounterId,
        appointmentId: appointment.id,
        message: "Appointment successfully linked to sync order",
      });
    } else {
      return NextResponse.json(
        { error: linkResult.error || "Failed to link appointment to order" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error linking appointment to order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
