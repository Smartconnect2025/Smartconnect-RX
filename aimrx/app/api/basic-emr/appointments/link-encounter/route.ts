import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@core/supabase/client";
import { getUser } from "@/core/auth/get-user";

import { appointmentEncounterService } from "@/features/basic-emr/services/appointmentEncounterService";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appointmentId } = await request.json();

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 },
      );
    }

    // Get appointment data
    const supabase = createClient();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    // Check if user is a provider
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
        { error: "Only providers can create encounters from appointments" },
        { status: 403 },
      );
    }

    // Create encounter from appointment
    const appointmentData = {
      id: appointment.id,
      reference: appointment.id, // Using ID as reference for now
      patientId: appointment.patient_id,
      providerId: appointment.provider_id,
      appointmentDate: appointment.datetime,
      title: appointment.reason,
      status: "scheduled",
    };

    const result =
      await appointmentEncounterService.createEncounterFromAppointment(
        user.id,
        appointmentData,
      );

    if (result.success) {
      return NextResponse.json({
        success: true,
        encounterId: result.encounterId,
        message: "Encounter created successfully from appointment",
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("Error linking appointment to encounter:", error);
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
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 },
      );
    }

    const encounter =
      await appointmentEncounterService.getEncounterByAppointmentId(
        appointmentId,
      );

    return NextResponse.json({
      success: true,
      encounter,
    });
  } catch (error) {
    console.error("Error getting encounter by appointment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
