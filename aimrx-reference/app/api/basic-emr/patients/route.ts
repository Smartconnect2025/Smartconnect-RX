import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@core/database/client";
import { patientAuthService } from "@features/basic-emr/services/patientAuthService";
import { envConfig } from "@core/config";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

/**
 * Resolve the caller's own providers.id. Both providers and Provider
 * Assistants (delegates) have their own providers row — for assistants the
 * row is auto-provisioned during admin approval (see
 * `app/api/admin/delegations/[id]/approve/route.ts`). Patient sharing
 * between an assistant and the authorizing provider is handled by the
 * existing clinic-sharing RPC, not by overlaying provider IDs here.
 */
async function resolveOwnProviderId(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveClinicProviderIds(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  ownProviderId: string,
): Promise<string[]> {
  const { data: ownerRow } = await supabaseAdmin
    .from("providers")
    .select("company_name")
    .eq("id", ownProviderId)
    .maybeSingle();
  const company = ownerRow?.company_name;
  if (!company) return [ownProviderId];
  const { data: clinicRows } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("company_name", company);
  const ids = (clinicRows || []).map((r) => r.id);
  if (!ids.includes(ownProviderId)) ids.push(ownProviderId);
  return ids;
}

// Patients table has no top-level `gender` column — gender (if stored)
// lives inside the `data` JSONB blob. Selecting it explicitly causes a
// 500 from PostgREST, so keep this list aligned with the real columns.
const baseSelectWithGender = `
  id, user_id, first_name, last_name, email, phone, date_of_birth,
  data, physical_address, billing_address, allergies, is_active,
  created_at, updated_at
`;

export interface CreatePatientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  physicalAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  preferredLanguage?: string;
  allergies?: string;
}

/**
 * GET /api/basic-emr/patients?q=&page=&limit=
 *
 * Returns the patient panel for the caller (provider, admin, or
 * Provider Assistant/delegate). Uses the admin client so RLS on
 * `patients` and `provider_patient_mappings` does not block reads from
 * delegate-role users — the same RLS issue that previously hid the
 * profile.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const supabaseAuth = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only auth in this handler.
          },
        },
      },
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role;

    // Single-patient fetch: ?id=<uuid>. Used by the prescription wizard
    // (step 3) which previously read directly from supabase and was
    // blocked by RLS for delegate-role users.
    const singleId = url.searchParams.get("id");
    if (singleId) {
      // Authorization: admins can read anyone; providers / delegates can
      // only read patients mapped to a provider in their clinic.
      if (role === "admin") {
        const { data, error } = await adminClient
          .from("patients")
          .select(baseSelectWithGender)
          .eq("id", singleId)
          .maybeSingle();
        if (error) throw error;
        if (!data)
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ patient: data });
      }
      if (role === "provider" || role === "delegate") {
        const ownProviderId = await resolveOwnProviderId(adminClient, user.id);
        if (!ownProviderId)
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const providerIds = await resolveClinicProviderIds(
          adminClient,
          ownProviderId,
        );
        // Authorization: allow if the patient is linked to any provider
        // in the caller's clinic via EITHER (a) provider_patient_mappings
        // or (b) patients.provider_id directly. Legacy patients created
        // before the mapping table existed only have (b), and the old
        // RLS policy let providers read them — preserve that behaviour.
        const { data: patientRow, error: patientErr } = await adminClient
          .from("patients")
          .select(`${baseSelectWithGender}, provider_id`)
          .eq("id", singleId)
          .maybeSingle();
        if (patientErr) throw patientErr;
        if (!patientRow)
          return NextResponse.json({ error: "Not found" }, { status: 404 });

        let allowed = false;
        const directProviderId = (patientRow as { provider_id?: string | null })
          .provider_id;
        if (directProviderId && providerIds.includes(directProviderId)) {
          allowed = true;
        }
        if (!allowed) {
          const { data: mapping } = await adminClient
            .from("provider_patient_mappings")
            .select("patient_id")
            .eq("patient_id", singleId)
            .in("provider_id", providerIds)
            .maybeSingle();
          if (mapping) allowed = true;
        }
        if (!allowed)
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        return NextResponse.json({ patient: patientRow });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = (url.searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)),
    );
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const baseSelect = `
      id, user_id, first_name, last_name, email, phone, date_of_birth,
      data, physical_address, billing_address, allergies, is_active,
      created_at, updated_at
    `;

    // Admin: see every active patient.
    if (role === "admin") {
      let query = adminClient
        .from("patients")
        .select(baseSelect)
        .eq("is_active", true);
      if (q) {
        query = query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
        );
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return NextResponse.json({ patients: data || [] });
    }

    // Provider or Provider Assistant (delegate): same code path.
    if (role === "provider" || role === "delegate") {
      const ownProviderId = await resolveOwnProviderId(adminClient, user.id);
      if (!ownProviderId) return NextResponse.json({ patients: [] });

      // Pull every provider in the same clinic so an assistant sees the
      // authorizing provider's panel and vice versa, just like the
      // existing terminal does for clinic-shared providers.
      const { data: ownerRow } = await adminClient
        .from("providers")
        .select("company_name")
        .eq("id", ownProviderId)
        .maybeSingle();
      const company = ownerRow?.company_name;
      let providerIds: string[] = [ownProviderId];
      if (company) {
        const { data: clinicRows } = await adminClient
          .from("providers")
          .select("id")
          .eq("company_name", company);
        providerIds = (clinicRows || []).map((r) => r.id);
        if (!providerIds.includes(ownProviderId))
          providerIds.push(ownProviderId);
      }

      const { data: mappings } = await adminClient
        .from("provider_patient_mappings")
        .select("patient_id")
        .in("provider_id", providerIds);
      const patientIds = Array.from(
        new Set((mappings || []).map((m) => m.patient_id)),
      );
      if (patientIds.length === 0)
        return NextResponse.json({ patients: [] });

      let query = adminClient
        .from("patients")
        .select(baseSelect)
        .in("id", patientIds)
        .eq("is_active", true);
      if (q) {
        query = query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
        );
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return NextResponse.json({ patients: data || [] });
    }

    // Patient role and others: do not expose other patients.
    return NextResponse.json({ patients: [] });
  } catch (err) {
    console.error("GET /api/basic-emr/patients failed:", err);
    return NextResponse.json(
      { error: "Failed to load patients" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // For API routes, we don't need to set cookies back
            // The session is read-only in this context
          },
        },
      },
    );

    // Get the current user from the request
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const patientData: CreatePatientData = await request.json();

    // Create admin client for operations that need to bypass RLS
    const adminClient = createAdminClient();

    // Resolve the caller's OWN providers row. Both providers and assistants
    // have their own row (assistants are auto-provisioned on approval).
    const ownProviderId = await resolveOwnProviderId(adminClient, user.id);
    if (!ownProviderId) {
      return NextResponse.json(
        {
          error:
            "No provider record found for this account. Please contact support.",
          userId: user.id,
        },
        { status: 403 },
      );
    }
    const providerData = { id: ownProviderId };

    // Check if a patient with this email already exists (use adminClient to bypass RLS)
    const { data: existingPatient } = await adminClient
      .from("patients")
      .select("id, first_name, last_name")
      .eq("email", patientData.email)
      .single();

    if (existingPatient) {
      return NextResponse.json(
        {
          error: `A patient with email ${patientData.email} already exists`,
          details: `Patient: ${existingPatient.first_name} ${existingPatient.last_name}`,
        },
        { status: 409 },
      );
    }

    // Check if auth user already exists
    const {
      data: { users: existingAuthUsers },
    } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.find(
      (u) => u.email === patientData.email,
    );

    let authUserId: string;

    if (existingAuthUser) {
      // User exists in auth but not in patients table - reuse the auth user
      authUserId = existingAuthUser.id;
    } else {
      // Generate a temporary password (patient will need to reset it)
      const tempPassword = `Temp${Math.random().toString(36).substring(2, 15)}!`;

      const { data: authUser, error: authUserError } =
        await adminClient.auth.admin.createUser({
          email: patientData.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            role: "patient",
          },
        });

      if (authUserError || !authUser.user) {
        return NextResponse.json(
          {
            error: `Failed to create patient auth account: ${authUserError?.message}`,
          },
          { status: 400 },
        );
      }

      authUserId = authUser.user.id;
    }

    // Create patient record
    // Use provider record ID (required by foreign key constraint)
    const dbPatient = {
      user_id: authUserId,
      first_name: patientData.firstName,
      last_name: patientData.lastName,
      email: patientData.email,
      phone: patientData.phone,
      date_of_birth: patientData.dateOfBirth,
      provider_id: providerData.id,
      physical_address:
        patientData?.address || patientData?.physicalAddress || null,
      billing_address: patientData?.billingAddress || null,
      allergies: patientData?.allergies?.trim() || null,
      data: {
        gender: patientData?.gender,
        // address is now stored in physical_address column, not in data
        emergencyContact: patientData?.emergencyContact,
        insurance: patientData?.insurance,
        preferredLanguage: patientData?.preferredLanguage,
      },
    };

    // Use adminClient to bypass RLS since provider is creating a patient for another user
    const { data: patient, error: patientError } = await adminClient
      .from("patients")
      .insert([dbPatient])
      .select()
      .single();

    if (patientError) {
      console.error("Patient creation RLS error:", patientError);
      console.error("Provider ID used:", providerData.id);
      // If patient creation fails, clean up the auth user (only if we just created it)
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(authUserId);
      }
      return NextResponse.json(
        {
          error: `Failed to create patient record: ${patientError.message}`,
          details: patientError,
          providerId: providerData.id,
        },
        { status: 400 },
      );
    }

    // Create provider-patient mapping (use adminClient to bypass RLS;
    // an assistant acting on behalf of the provider has no row-level match)
    const { error: mappingError } = await adminClient
      .from("provider_patient_mappings")
      .insert({
        provider_id: providerData.id,
        patient_id: patient.id,
      });

    if (mappingError) {
      await adminClient.from("patients").delete().eq("id", patient.id);
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(authUserId);
      }
      return NextResponse.json(
        {
          error: `Failed to create provider-patient mapping: ${mappingError.message}`,
        },
        { status: 400 },
      );
    }

    // Sync patient access to all other providers in the same clinic (group)
    try {
      const { error: syncError } = await adminClient.rpc("sync_group_patient_mappings_for_patient", {
        p_patient_id: patient.id,
        p_creator_provider_id: providerData.id,
      });
      if (syncError) {
        console.error("Clinic patient sync RPC error (non-fatal):", syncError.message, { patientId: patient.id, providerId: providerData.id });
      }
    } catch (syncError) {
      console.error("Clinic patient sync error (non-fatal):", syncError);
    }

    // Send welcome email to patient (optional - don't fail if this doesn't work)
    try {
      await patientAuthService.sendWelcomeEmail(
        patientData.email,
        `${patientData.firstName} ${patientData.lastName}`,
      );
    } catch {
      // Log the error but don't fail the patient creation
    }

    // Map the database patient to the expected format
    const mappedPatient = {
      id: patient.id,
      firstName: patient.first_name,
      lastName: patient.last_name,
      email: patient.email || "",
      phone: patient.phone || "",
      dateOfBirth: patient.date_of_birth,
      gender: patient.data?.gender,
      // Read from physical_address column, fallback to data.address for legacy records
      address: patient.physical_address || patient.data?.address,
      physical_address: patient.physical_address,
      billing_address: patient.billing_address,
      emergencyContact: patient.data?.emergencyContact,
      insurance: patient.data?.insurance,
      preferredLanguage: patient.data?.preferredLanguage,
      allergies: patient.allergies ?? null,
      is_active: patient.is_active,
    };

    return NextResponse.json({
      success: true,
      data: mappedPatient,
    });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
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
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const patientId: string | undefined = body?.patientId;
    const updates = body?.updates as
      | Partial<CreatePatientData>
      | undefined;
    if (!patientId || !updates) {
      return NextResponse.json(
        { error: "patientId and updates are required" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // Authorization: must be admin, OR a provider/delegate whose clinic
    // currently has this patient mapped. Mirrors GET-list scoping so we
    // never let a caller mutate someone else's patient.
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = (roleRow as { role?: string } | null)?.role ?? null;

    if (role !== "admin") {
      const ownProviderId = await resolveOwnProviderId(adminClient, user.id);
      if (!ownProviderId) {
        return NextResponse.json(
          { error: "No provider record found for this account." },
          { status: 403 },
        );
      }
      const clinicIds = await resolveClinicProviderIds(
        adminClient,
        ownProviderId,
      );
      // Authorization: allow PATCH if the patient is linked to any
      // provider in the caller's clinic via EITHER (a) a row in
      // provider_patient_mappings or (b) patients.provider_id directly.
      // Legacy patients created before the mapping table existed only
      // have (b); without this check, providers could view those rows
      // (GET allows the legacy path) but Save would fail with "not
      // found in your clinic." Mirrors the GET single-patient logic.
      let allowed = false;
      const { data: legacyRow } = await adminClient
        .from("patients")
        .select("provider_id")
        .eq("id", patientId)
        .maybeSingle();
      const directProviderId =
        (legacyRow as { provider_id?: string | null } | null)?.provider_id;
      if (directProviderId && clinicIds.includes(directProviderId)) {
        allowed = true;
      }
      if (!allowed) {
        const { data: mappingHit } = await adminClient
          .from("provider_patient_mappings")
          .select("patient_id")
          .eq("patient_id", patientId)
          .in("provider_id", clinicIds)
          .maybeSingle();
        if (mappingHit) allowed = true;
      }
      if (!allowed) {
        return NextResponse.json(
          { error: "Patient not found in your clinic." },
          { status: 404 },
        );
      }
    }

    // Build column-level updates. JSONB `data` fields (gender,
    // emergencyContact, insurance, preferredLanguage) are merged with the
    // existing blob so partial updates do not erase other fields.
    const dbUpdates: Record<string, unknown> = {};
    if (updates.firstName) dbUpdates.first_name = updates.firstName;
    if (updates.lastName) dbUpdates.last_name = updates.lastName;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.dateOfBirth) dbUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.address) dbUpdates.physical_address = updates.address;
    if ((updates as { physicalAddress?: unknown }).physicalAddress) {
      dbUpdates.physical_address = (
        updates as { physicalAddress?: unknown }
      ).physicalAddress;
    }
    if (updates.billingAddress) {
      dbUpdates.billing_address = updates.billingAddress;
    }
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
      const { data: currentRow } = await adminClient
        .from("patients")
        .select("data")
        .eq("id", patientId)
        .maybeSingle();
      const currentJson =
        ((currentRow as { data?: Record<string, unknown> } | null)?.data) || {};
      const newJson: Record<string, unknown> = { ...currentJson };
      if (updates.gender) newJson.gender = updates.gender;
      if (updates.emergencyContact)
        newJson.emergencyContact = updates.emergencyContact;
      if (updates.insurance) newJson.insurance = updates.insurance;
      if (updates.preferredLanguage)
        newJson.preferredLanguage = updates.preferredLanguage;
      dbUpdates.data = newJson;
    }

    if (Object.keys(dbUpdates).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await adminClient
      .from("patients")
      .update(dbUpdates)
      .eq("id", patientId)
      .eq("is_active", true)
      .select(baseSelectWithGender)
      .single();

    if (updateError) {
      console.error("PATCH /api/basic-emr/patients update failed:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update patient" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("PATCH /api/basic-emr/patients failed:", err);
    return NextResponse.json(
      { error: "Failed to update patient" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { patientId } = await request.json();
    if (!patientId) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const ownProviderId = await resolveOwnProviderId(adminClient, user.id);
    if (!ownProviderId) {
      return NextResponse.json(
        { error: "No provider record found for this account." },
        { status: 403 },
      );
    }
    const providerData = { id: ownProviderId };

    const { data: mapping } = await adminClient
      .from("provider_patient_mappings")
      .select("id")
      .eq("provider_id", providerData.id)
      .eq("patient_id", patientId)
      .single();

    if (!mapping) {
      return NextResponse.json({ error: "You do not have access to this patient" }, { status: 403 });
    }

    await adminClient
      .from("provider_patient_mappings")
      .delete()
      .eq("patient_id", patientId);

    const { error: deleteError } = await adminClient
      .from("patients")
      .delete()
      .eq("id", patientId);

    if (deleteError) {
      return NextResponse.json({ error: `Failed to delete patient: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting patient:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
