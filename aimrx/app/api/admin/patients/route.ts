/**
 * Admin Patients API
 *
 * Endpoint for admin users to fetch patient data
 * Only accessible to users with admin role
 */

import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export async function GET() {
  try {
    // Check if the current user is an admin
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    // Get all patients from the patients table
    const { data: patients, error } = await supabase
      .from("patients")
      .select("*");

    if (error) {
      console.error("Error fetching patients:", error);
      return NextResponse.json(
        { error: "Failed to fetch patients" },
        { status: 500 },
      );
    }

    // Transform the data to match the expected format
    const transformedPatients =
      patients?.map((patient) => ({
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        avatar_url: patient.avatar_url || "",
        phone_number: patient.phone_number,
        date_of_birth: patient.date_of_birth,
        city: patient.city,
        state: patient.state,
        created_at: patient.created_at,
        status: patient.is_active ? "active" : "inactive",
        role: "user", // Hardcoded as per schema, since we filtered by role = 'user'
      })) || [];

    return NextResponse.json({
      patients: transformedPatients,
      total: transformedPatients.length,
    });
  } catch (error) {
    console.error("Error listing patients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
