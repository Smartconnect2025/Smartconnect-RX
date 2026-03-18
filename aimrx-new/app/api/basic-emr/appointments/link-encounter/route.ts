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

    if (userRole.role === "provider") {
      const { data: providerData } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!providerData) {
        return NextResponse.json(
          { error: "Provider record not found" },
          { status: 403 },
        );
      }
      if (appointment.patient_id) {
        const { data: mapping } = await supabase
          .from("provider_patient_mappings")
          .select("id")
          .eq("provider_id", providerData.id)
          .eq("patient_id", appointment.patient_id)
          .single();
        if (!mapping) {
          return NextResponse.json(
            { error: "You do not have access to this patient's appointments" },
            { status: 403 },
          );
        }
      }
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
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userRole || !["provider", "admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Only providers and admins can check appointment encounters" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 },
      );
    }

    if (userRole === "provider") {
      const supabase = createClient();
      const { data: apptData } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("id", appointmentId)
        .single();
      if (!apptData) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 },
        );
      }
      if (apptData.patient_id) {
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (!providerData) {
          return NextResponse.json(
            { error: "Provider record not found" },
            { status: 403 },
          );
        }
        const { data: mapping } = await supabase
          .from("provider_patient_mappings")
          .select("id")
          .eq("provider_id", providerData.id)
          .eq("patient_id", apptData.patient_id)
          .single();
        if (!mapping) {
          return NextResponse.json(
            { error: "You do not have access to this patient's appointments" },
            { status: 403 },
          );
        }
      }
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
