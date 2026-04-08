import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requireAnyAdmin, createGuardErrorResponse, requireNonDemo } from "@core/auth/api-guards";

export async function GET() {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  try {
    const supabase = createAdminClient();
    const isPharmacyAdmin = adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId;
    const pharmacyId = adminCheck.pharmacyScope?.pharmacyId;

    const { data: settingsRows, error: settingsError } = await supabase
      .from("app_settings")
      .select("id, key, value")
      .eq("category", "provider_companies");

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    let companyEntries: { id: string; name: string; pharmacyId: string | null }[] = [];
    for (const row of settingsRows || []) {
      try {
        const parsed = JSON.parse(row.value);
        companyEntries.push({ id: row.id, name: parsed.name, pharmacyId: parsed.pharmacy_id || null });
      } catch {
        continue;
      }
    }

    if (isPharmacyAdmin) {
      companyEntries = companyEntries.filter(c => c.pharmacyId === pharmacyId || c.pharmacyId === null);
    }

    let providerQuery = supabase
      .from("providers")
      .select("id, company_name, user_id, first_name, last_name");

    if (isPharmacyAdmin) {
      const { data: links } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", pharmacyId);

      const providerUserIds = (links || []).map((l: { provider_id: string }) => l.provider_id);
      if (providerUserIds.length > 0) {
        providerQuery = providerQuery.in("user_id", providerUserIds);
      } else {
        providerQuery = providerQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const { data: providers } = await providerQuery;

    const providersByCompany = new Map<string, { id: string; name: string }[]>();
    for (const p of providers || []) {
      if (!p.company_name) continue;
      if (!providersByCompany.has(p.company_name)) {
        providersByCompany.set(p.company_name, []);
      }
      providersByCompany.get(p.company_name)!.push({
        id: p.id,
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
      });
    }

    const companies = companyEntries.map(c => ({
      id: c.id,
      name: c.name,
      providerCount: providersByCompany.get(c.name)?.length || 0,
      providers: providersByCompany.get(c.name) || [],
    })).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error in companies GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  const demoCheck = await requireNonDemo();
  if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

  try {
    const { name, pharmacyId: requestedPharmacyId } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const supabase = createAdminClient();

    const isPharmacyAdmin = adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId;
    const resolvedPharmacyId = isPharmacyAdmin
      ? adminCheck.pharmacyScope!.pharmacyId
      : (requestedPharmacyId || null);

    const settingsKey = `company_${trimmedName.toLowerCase().replace(/\s+/g, "_")}_${resolvedPharmacyId || "global"}`;

    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", settingsKey)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Company already exists" }, { status: 409 });
    }

    const { data: inserted, error } = await supabase
      .from("app_settings")
      .insert({
        key: settingsKey,
        value: JSON.stringify({ name: trimmedName, pharmacy_id: resolvedPharmacyId }),
        description: `Provider company: ${trimmedName}`,
        category: "provider_companies",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating company:", error);
      return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
    }

    return NextResponse.json({ success: true, company: { id: inserted.id, name: trimmedName } });
  } catch (error) {
    console.error("Error in companies POST:", error);
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

    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("id, key, value")
      .eq("category", "provider_companies");

    const matchingRow = (settingsRows || []).find(row => {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed.name !== trimmedOld) return false;
        if (isPharmacyAdmin) {
          return parsed.pharmacy_id === adminCheck.pharmacyScope!.pharmacyId || parsed.pharmacy_id === null;
        }
        return true;
      } catch { return false; }
    });

    if (!matchingRow) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const parsed = JSON.parse(matchingRow.value);
    const newKey = `company_${trimmedNew.toLowerCase().replace(/\s+/g, "_")}_${parsed.pharmacy_id || "global"}`;

    await supabase
      .from("app_settings")
      .update({
        key: newKey,
        value: JSON.stringify({ ...parsed, name: trimmedNew }),
        description: `Provider company: ${trimmedNew}`,
      })
      .eq("id", matchingRow.id);

    let providerIds: string[] | null = null;

    if (isPharmacyAdmin) {
      const { data: links } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", adminCheck.pharmacyScope!.pharmacyId);

      const providerUserIds = (links || []).map((l: { provider_id: string }) => l.provider_id);
      if (providerUserIds.length === 0) {
        return NextResponse.json({ error: "No providers found in your pharmacy" }, { status: 404 });
      }

      const { data: pharmacyProviders } = await supabase
        .from("providers")
        .select("id")
        .eq("company_name", trimmedOld)
        .in("user_id", providerUserIds);

      providerIds = (pharmacyProviders || []).map((p: { id: string }) => p.id);
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

    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("id, key, value")
      .eq("category", "provider_companies");

    const matchingRow = (settingsRows || []).find(row => {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed.name !== trimmedName) return false;
        if (isPharmacyAdmin) {
          return parsed.pharmacy_id === adminCheck.pharmacyScope!.pharmacyId || parsed.pharmacy_id === null;
        }
        return true;
      } catch { return false; }
    });

    if (!matchingRow) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await supabase
      .from("app_settings")
      .delete()
      .eq("id", matchingRow.id);

    let affectedProviderIds: string[] = [];

    if (isPharmacyAdmin) {
      const { data: links } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", adminCheck.pharmacyScope!.pharmacyId);

      const providerUserIds = (links || []).map((l: { provider_id: string }) => l.provider_id);

      const { data: pharmacyProviders } = await supabase
        .from("providers")
        .select("id")
        .eq("company_name", trimmedName)
        .in("user_id", providerUserIds);

      affectedProviderIds = (pharmacyProviders || []).map((p: { id: string }) => p.id);
    } else {
      const { data: allProviders } = await supabase
        .from("providers")
        .select("id")
        .eq("company_name", trimmedName);

      affectedProviderIds = (allProviders || []).map((p: { id: string }) => p.id);
    }

    for (const providerId of affectedProviderIds) {
      const { data: ownedPatientIds } = await supabase
        .from("patients")
        .select("id")
        .eq("provider_id", providerId);

      const ownedIds = new Set((ownedPatientIds || []).map((p: { id: string }) => p.id));

      const { data: allMappings } = await supabase
        .from("provider_patient_mappings")
        .select("patient_id")
        .eq("provider_id", providerId);

      const mappingsToRemove = (allMappings || [])
        .filter((m: { patient_id: string }) => !ownedIds.has(m.patient_id))
        .map((m: { patient_id: string }) => m.patient_id);

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

    await clearQuery;

    return NextResponse.json({
      success: true,
      message: `Company "${trimmedName}" deleted and removed from ${affectedProviderIds.length} provider(s)`,
      affectedCount: affectedProviderIds.length,
    });
  } catch (error) {
    console.error("Error in companies DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
