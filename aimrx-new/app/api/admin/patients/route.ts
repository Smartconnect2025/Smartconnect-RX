/**
 * Admin Patients API
 *
 * Endpoint for admin users to fetch patient data
 * Only accessible to users with admin role
 */

import { NextResponse, NextRequest } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function GET(request: NextRequest) {
  try {
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

    const scope = await getPharmacyAdminScope(user.id);
    const supabase = createAdminClient();

    if (scope.isPharmacyAdmin && !scope.pharmacyId) {
      return NextResponse.json(
        { error: "Unable to determine pharmacy scope" },
        { status: 403 },
      );
    }

    if (scope.isPharmacyAdmin && scope.pharmacyId) {
      const { data: patients, error } = await supabase
        .from("patients")
        .select("*")
        .eq("pharmacy_id", scope.pharmacyId);

      if (error) {
        console.error("Error fetching patients:", error);
        return NextResponse.json(
          { error: "Failed to fetch patients" },
          { status: 500 },
        );
      }

      const { data: pharmacyRow } = await supabase
        .from("pharmacies")
        .select("name")
        .eq("id", scope.pharmacyId)
        .single();

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
          role: "user",
          pharmacy_id: patient.pharmacy_id || null,
          pharmacy_name: pharmacyRow?.name || null,
        })) || [];

      return NextResponse.json({
        patients: transformedPatients,
        total: transformedPatients.length,
      });
    }

    const isSuperAdmin = userRole === "super_admin";
    const filterPharmacyId = isSuperAdmin ? request.nextUrl.searchParams.get("pharmacyId") : null;

    let query = supabase.from("patients").select("*");
    if (filterPharmacyId) {
      query = query.eq("pharmacy_id", filterPharmacyId);
    }

    const { data: patients, error } = await query;

    if (error) {
      console.error("Error fetching patients:", error);
      return NextResponse.json(
        { error: "Failed to fetch patients" },
        { status: 500 },
      );
    }

    const pharmacyIds = [...new Set((patients || []).map((p) => p.pharmacy_id).filter(Boolean))];
    let pharmacyNameMap = new Map<string, string>();
    if (pharmacyIds.length > 0) {
      const { data: pharmacyRows } = await supabase
        .from("pharmacies")
        .select("id, name")
        .in("id", pharmacyIds);
      pharmacyNameMap = new Map((pharmacyRows || []).map((p) => [p.id, p.name]));
    }

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
        role: "user",
        pharmacy_id: patient.pharmacy_id || null,
        pharmacy_name: patient.pharmacy_id ? (pharmacyNameMap.get(patient.pharmacy_id) || null) : null,
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
