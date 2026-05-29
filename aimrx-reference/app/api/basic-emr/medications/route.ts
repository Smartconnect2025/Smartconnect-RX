import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { createAdminClient } from "@core/database/client";
import { envConfig } from "@core/config";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

type DbMedicationRow = {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapMedication(row: DbMedicationRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    startDate: row.start_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthedUser(request: NextRequest) {
  const supabase = createServerClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function resolveOwnProviderId(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await adminClient
    .from("providers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveClinicProviderIds(
  adminClient: ReturnType<typeof createAdminClient>,
  ownProviderId: string,
): Promise<string[]> {
  const { data: owner } = await adminClient
    .from("providers")
    .select("company_name")
    .eq("id", ownProviderId)
    .maybeSingle();
  const company = owner?.company_name;
  if (!company) return [ownProviderId];
  const { data: rows } = await adminClient
    .from("providers")
    .select("id")
    .eq("company_name", company);
  const ids = (rows || []).map((r) => r.id);
  if (!ids.includes(ownProviderId)) ids.push(ownProviderId);
  return ids;
}

/**
 * Authorize the caller for this patientId. Mirrors the proven check in
 * app/api/basic-emr/patients/[id]/route.ts so behavior is identical:
 *   - admin: always allowed
 *   - provider/delegate: allowed if patient is mapped to caller's clinic
 *     OR (legacy) directly references caller's provider row via
 *     patients.provider_id
 *   - patient role: only their own record
 */
async function callerCanAccessPatient(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  patientId: string,
): Promise<boolean> {
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (roleRow as { role?: string } | null)?.role ?? null;

  if (role === "admin") return true;

  if (role === "provider" || role === "delegate") {
    const ownProviderId = await resolveOwnProviderId(adminClient, userId);
    if (!ownProviderId) return false;
    const clinicIds = await resolveClinicProviderIds(adminClient, ownProviderId);

    const { data: mapHit } = await adminClient
      .from("provider_patient_mappings")
      .select("patient_id")
      .eq("patient_id", patientId)
      .in("provider_id", clinicIds)
      .maybeSingle();
    if (mapHit) return true;

    const { data: legacyHit } = await adminClient
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .in("provider_id", clinicIds)
      .maybeSingle();
    return !!legacyHit;
  }

  const { data: pat } = await adminClient
    .from("patients")
    .select("user_id")
    .eq("id", patientId)
    .maybeSingle();
  return pat?.user_id === userId;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const patientId = request.nextUrl.searchParams.get("patientId");
    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "patientId is required" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    if (!(await callerCanAccessPatient(adminClient, user.id, patientId))) {
      return NextResponse.json(
        { success: false, error: "Patient not found or access denied" },
        { status: 404 },
      );
    }

    const { data, error } = await adminClient
      .from("medications")
      .select("*")
      .eq("patient_id", patientId)
      .order("start_date", { ascending: false });

    if (error) {
      console.error("GET /api/basic-emr/medications query failed:", error);
      return NextResponse.json(
        { success: false, error: "Failed to load medications" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: (data || []).map((row) => mapMedication(row as DbMedicationRow)),
    });
  } catch (err) {
    console.error("GET /api/basic-emr/medications failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load medications" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const {
      patientId,
      encounterId,
      name,
      dosage,
      frequency,
      startDate,
      status,
    } = body || {};

    if (!patientId || !name || !dosage || !frequency || !startDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "patientId, name, dosage, frequency, and startDate are required",
        },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    if (!(await callerCanAccessPatient(adminClient, user.id, patientId))) {
      return NextResponse.json(
        { success: false, error: "Patient not found or access denied" },
        { status: 404 },
      );
    }

    // medications.start_date is DATE; coerce ISO timestamp to YYYY-MM-DD.
    const startDateOnly = String(startDate).slice(0, 10);

    const { data, error } = await adminClient
      .from("medications")
      .insert([
        {
          patient_id: patientId,
          encounter_id: encounterId ?? null,
          name: String(name).trim(),
          dosage: String(dosage).trim(),
          frequency: String(frequency).trim(),
          start_date: startDateOnly,
          status: status || "active",
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error("POST /api/basic-emr/medications insert failed:", error);
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to create medication" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: mapMedication(data as DbMedicationRow),
    });
  } catch (err) {
    console.error("POST /api/basic-emr/medications failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create medication" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { id, name, dosage, frequency, startDate, status } = body || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    const { data: medRow } = await adminClient
      .from("medications")
      .select("patient_id")
      .eq("id", id)
      .maybeSingle();
    if (!medRow) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 },
      );
    }

    if (!(await callerCanAccessPatient(adminClient, user.id, medRow.patient_id))) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }

    const dbUpdates: Record<string, unknown> = {};
    if (name !== undefined) dbUpdates.name = name;
    if (dosage !== undefined) dbUpdates.dosage = dosage;
    if (frequency !== undefined) dbUpdates.frequency = frequency;
    if (startDate !== undefined) dbUpdates.start_date = String(startDate).slice(0, 10);
    if (status !== undefined) dbUpdates.status = status;

    if (Object.keys(dbUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updatable fields provided" },
        { status: 400 },
      );
    }

    const { data, error } = await adminClient
      .from("medications")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("PATCH /api/basic-emr/medications update failed:", error);
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to update medication" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: mapMedication(data as DbMedicationRow),
    });
  } catch (err) {
    console.error("PATCH /api/basic-emr/medications failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update medication" },
      { status: 500 },
    );
  }
}
