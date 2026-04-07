import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requireAnyAdmin, createGuardErrorResponse, requireNonDemo } from "@core/auth/api-guards";

export async function GET() {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  try {
    const supabase = createAdminClient();
    const isPharmacyAdmin = adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId;

    let query = supabase
      .from("providers")
      .select("id, company_name, user_id, first_name, last_name");

    if (isPharmacyAdmin) {
      const { data: links } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", adminCheck.pharmacyScope!.pharmacyId);

      const providerUserIds = (links || []).map((l) => l.provider_id);
      if (providerUserIds.length === 0) {
        return NextResponse.json({ companies: [] });
      }
      query = query.in("user_id", providerUserIds);
    }

    const { data: providers, error } = await query;

    if (error) {
      console.error("Error fetching providers for companies:", error);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    const companyMap = new Map<string, { name: string; providerCount: number; providers: { id: string; name: string }[] }>();

    for (const p of providers || []) {
      const companyName = p.company_name || null;
      if (!companyName) continue;

      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, { name: companyName, providerCount: 0, providers: [] });
      }
      const entry = companyMap.get(companyName)!;
      entry.providerCount++;
      entry.providers.push({
        id: p.id,
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
      });
    }

    const companies = Array.from(companyMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error in companies GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  const demoCheck = await requireNonDemo();
  if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

  try {
    const { oldName, newName } = await request.json();

    if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
      return NextResponse.json({ error: "Both old and new company names are required" }, { status: 400 });
    }

    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();

    if (trimmedOld === trimmedNew) {
      return NextResponse.json({ success: true, message: "No change needed" });
    }

    const supabase = createAdminClient();
    const isPharmacyAdmin = adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId;

    let providerIds: string[] | null = null;

    if (isPharmacyAdmin) {
      const { data: links } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", adminCheck.pharmacyScope!.pharmacyId);

      const providerUserIds = (links || []).map((l) => l.provider_id);
      if (providerUserIds.length === 0) {
        return NextResponse.json({ error: "No providers found in your pharmacy" }, { status: 404 });
      }

      const { data: pharmacyProviders } = await supabase
        .from("providers")
        .select("id")
        .eq("company_name", trimmedOld)
        .in("user_id", providerUserIds);

      providerIds = (pharmacyProviders || []).map((p) => p.id);
      if (providerIds.length === 0) {
        return NextResponse.json({ error: "Company not found within your pharmacy" }, { status: 404 });
      }
    }

    let updateQuery = supabase
      .from("providers")
      .update({ company_name: trimmedNew })
      .eq("company_name", trimmedOld);

    if (providerIds) {
      updateQuery = updateQuery.in("id", providerIds);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error("Error renaming company:", error);
      return NextResponse.json({ error: "Failed to rename company" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Company renamed to "${trimmedNew}"` });
  } catch (error) {
    console.error("Error in companies PATCH:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  const demoCheck = await requireNonDemo();
  if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

  try {
    const { companyName } = await request.json();

    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const trimmedName = companyName.trim();
    const supabase = createAdminClient();
    const isPharmacyAdmin = adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId;

    let affectedProviderIds: string[] = [];

    if (isPharmacyAdmin) {
      const { data: links } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", adminCheck.pharmacyScope!.pharmacyId);

      const providerUserIds = (links || []).map((l) => l.provider_id);

      const { data: pharmacyProviders } = await supabase
        .from("providers")
        .select("id")
        .eq("company_name", trimmedName)
        .in("user_id", providerUserIds);

      affectedProviderIds = (pharmacyProviders || []).map((p) => p.id);
      if (affectedProviderIds.length === 0) {
        return NextResponse.json({ error: "Company not found within your pharmacy" }, { status: 404 });
      }
    } else {
      const { data: allProviders } = await supabase
        .from("providers")
        .select("id")
        .eq("company_name", trimmedName);

      affectedProviderIds = (allProviders || []).map((p) => p.id);
    }

    for (const providerId of affectedProviderIds) {
      const { data: ownedPatientIds } = await supabase
        .from("patients")
        .select("id")
        .eq("provider_id", providerId);

      const ownedIds = new Set((ownedPatientIds || []).map((p) => p.id));

      const { data: allMappings } = await supabase
        .from("provider_patient_mappings")
        .select("patient_id")
        .eq("provider_id", providerId);

      const mappingsToRemove = (allMappings || [])
        .filter((m) => !ownedIds.has(m.patient_id))
        .map((m) => m.patient_id);

      if (mappingsToRemove.length > 0) {
        await supabase
          .from("provider_patient_mappings")
          .delete()
          .eq("provider_id", providerId)
          .in("patient_id", mappingsToRemove);
      }
    }

    let clearQuery = supabase
      .from("providers")
      .update({ company_name: null })
      .eq("company_name", trimmedName);

    if (isPharmacyAdmin) {
      clearQuery = clearQuery.in("id", affectedProviderIds);
    }

    const { error } = await clearQuery;

    if (error) {
      console.error("Error deleting company:", error);
      return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Company "${trimmedName}" removed from ${affectedProviderIds.length} provider(s)`,
      affectedCount: affectedProviderIds.length,
    });
  } catch (error) {
    console.error("Error in companies DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
