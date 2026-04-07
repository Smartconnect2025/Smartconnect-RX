import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse, requireAnyAdmin } from "@core/auth/api-guards";

const ALLOWED_FIELDS = new Set([
  "first_name",
  "last_name",
  "phone_number",
  "company_name",
  "is_active",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  try {
    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const body = await request.json();

    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        sanitized[key] = body[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const isPharmacyAdmin = adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId;

    const { data: currentProvider } = await supabase
      .from("providers")
      .select("id, user_id, company_name")
      .eq("id", id)
      .single();

    if (!currentProvider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    if (isPharmacyAdmin) {
      const scopePharmacyId = adminCheck.pharmacyScope!.pharmacyId;

      const { data: link } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("provider_id", currentProvider.user_id)
        .eq("pharmacy_id", scopePharmacyId)
        .maybeSingle();

      if (!link) {
        return NextResponse.json(
          { error: "Provider not found within your pharmacy" },
          { status: 403 },
        );
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ success: true });
    }

    const oldCompanyName = currentProvider.company_name || null;
    const newCompanyName = sanitized.company_name !== undefined
      ? (sanitized.company_name as string | null)
      : oldCompanyName;

    const { data: updated, error } = await supabase
      .from("providers")
      .update(sanitized)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error updating provider:", error);
      return NextResponse.json(
        { error: "Failed to update provider" },
        { status: 500 },
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    if (sanitized.company_name !== undefined && oldCompanyName !== newCompanyName) {
      try {
        if (oldCompanyName) {
          const { data: ownedPatientIds } = await supabase
            .from("patients")
            .select("id")
            .eq("provider_id", currentProvider.id);

          const ownedIds = new Set((ownedPatientIds || []).map((p) => p.id));

          const { data: allMappings } = await supabase
            .from("provider_patient_mappings")
            .select("patient_id")
            .eq("provider_id", currentProvider.id);

          const mappingsToRemove = (allMappings || [])
            .filter((m) => !ownedIds.has(m.patient_id))
            .map((m) => m.patient_id);

          if (mappingsToRemove.length > 0) {
            await supabase
              .from("provider_patient_mappings")
              .delete()
              .eq("provider_id", currentProvider.id)
              .in("patient_id", mappingsToRemove);
          }
        }

        if (newCompanyName) {
          const { data: companyProviders } = await supabase
            .from("providers")
            .select("id")
            .eq("company_name", newCompanyName)
            .neq("id", currentProvider.id);

          if (companyProviders && companyProviders.length > 0) {
            const companyProviderIds = companyProviders.map((p) => p.id);

            const { data: companyPatients } = await supabase
              .from("patients")
              .select("id")
              .in("provider_id", companyProviderIds);

            if (companyPatients && companyPatients.length > 0) {
              const { data: existingMappings } = await supabase
                .from("provider_patient_mappings")
                .select("patient_id")
                .eq("provider_id", currentProvider.id);

              const existingPatientIds = new Set(
                (existingMappings || []).map((m) => m.patient_id),
              );

              const newMappings = companyPatients
                .filter((p) => !existingPatientIds.has(p.id))
                .map((p) => ({
                  provider_id: currentProvider.id,
                  patient_id: p.id,
                }));

              if (newMappings.length > 0) {
                await supabase
                  .from("provider_patient_mappings")
                  .insert(newMappings);
              }
            }
          }
        }
      } catch (syncError) {
        console.error("Non-fatal: Error syncing company patients:", syncError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating provider:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
