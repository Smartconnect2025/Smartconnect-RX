import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { createAdminClient } from "@core/database/client";
import { envConfig } from "@core/config";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

const baseSelect = `
  id, user_id, first_name, last_name, email, phone, date_of_birth,
  data, physical_address, billing_address, allergies, is_active,
  created_at, updated_at
`;

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
 * Authorize the caller for this patientId. Returns true for:
 *   - admins
 *   - providers/delegates whose clinic has this patient mapped
 *   - the patient themselves (own user_id matches)
 * The browser-side equivalent (patientService.verifyPatientAccess) was
 * silently failing for real providers under RLS drift, which is the
 * "Patient not found or access denied" report.
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
    const { data: hit } = await adminClient
      .from("provider_patient_mappings")
      .select("patient_id")
      .eq("patient_id", patientId)
      .in("provider_id", clinicIds)
      .maybeSingle();
    return !!hit;
  }

  // Patient role: only their own record.
  const { data: pat } = await adminClient
    .from("patients")
    .select("user_id")
    .eq("id", patientId)
    .maybeSingle();
  return pat?.user_id === userId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const { id: patientId } = await params;
    const adminClient = createAdminClient();

    if (!(await callerCanAccessPatient(adminClient, user.id, patientId))) {
      return NextResponse.json(
        { success: false, error: "Patient not found or access denied" },
        { status: 404 },
      );
    }

    const { data, error } = await adminClient
      .from("patients")
      .select(baseSelect)
      .eq("id", patientId)
      .eq("is_active", true)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/basic-emr/patients/[id] failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load patient" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: patientId } = await params;
    const updates = await request.json();
    const adminClient = createAdminClient();

    if (!(await callerCanAccessPatient(adminClient, user.id, patientId))) {
      return NextResponse.json(
        { success: false, error: "Patient not found or access denied" },
        { status: 404 },
      );
    }

    const dbUpdates: Record<string, unknown> = {};
    if (updates.firstName) dbUpdates.first_name = updates.firstName;
    if (updates.lastName) dbUpdates.last_name = updates.lastName;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.dateOfBirth) dbUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.address) dbUpdates.physical_address = updates.address;
    if (updates.physicalAddress) dbUpdates.physical_address = updates.physicalAddress;
    if (updates.billingAddress) dbUpdates.billing_address = updates.billingAddress;
    if (updates.allergies !== undefined) {
      const trimmed = (updates.allergies || "").trim();
      dbUpdates.allergies = trimmed.length > 0 ? trimmed : null;
    }

    if (
      updates.gender ||
      updates.emergencyContact ||
      updates.insurance ||
      updates.preferredLanguage
    ) {
      const { data: cur } = await adminClient
        .from("patients")
        .select("data")
        .eq("id", patientId)
        .maybeSingle();
      const json: Record<string, unknown> = { ...((cur?.data as Record<string, unknown>) || {}) };
      if (updates.gender) json.gender = updates.gender;
      if (updates.emergencyContact) json.emergencyContact = updates.emergencyContact;
      if (updates.insurance) json.insurance = updates.insurance;
      if (updates.preferredLanguage) json.preferredLanguage = updates.preferredLanguage;
      dbUpdates.data = json;
    }

    if (Object.keys(dbUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updatable fields provided" },
        { status: 400 },
      );
    }

    const { data, error } = await adminClient
      .from("patients")
      .update(dbUpdates)
      .eq("id", patientId)
      .eq("is_active", true)
      .select(baseSelect)
      .single();

    if (error) {
      console.error("PATCH /api/basic-emr/patients/[id] update failed:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Failed to update patient" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("PATCH /api/basic-emr/patients/[id] failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update patient" },
      { status: 500 },
    );
  }
}
