import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@core/config";

/**
 * GET /api/prescriptions/list
 *
 * Returns the prescription list visible to the caller. The caller sees
 * the entire CLINIC's prescriptions — not just rows where
 * `prescriber_id = caller.user_id`. This is the fix for the May 2026
 * "the girls placed an order and went back to check the status and it's
 * not there" incident: when a Provider Assistant submits an Rx, the
 * row is stamped with the assistant's own user.id, so the supervising
 * provider (and sibling assistants) couldn't see the order under the
 * old `prescriber_id = user.id` filter even though it was safely in
 * the DB and processing normally.
 *
 * The visible "clinic peer set" of user_ids is computed as:
 *   - the caller themselves
 *   - if the caller is a delegate (active row in `delegations` where
 *     delegate_user_id = caller): add the authorizing provider's
 *     user_id AND every sibling delegate of that same provider
 *   - if the caller is a provider with active delegations: add every
 *     active delegate_user_id under their providers.id
 *   - SAME-CLINIC providers (May 12 2026, LifeMed/Lydia Cole incident):
 *     every other provider whose `providers.company_name` matches the
 *     caller's clinic (case-insensitive, trimmed). Same rule as the
 *     EMR `resolveClinicProviderIds` patient-access check, so a clinic
 *     with multiple solo provider seats (LifeMed has Whipps + Lydia)
 *     shares one orders list. Their active delegates are also pulled
 *     in via the same expansion.
 *
 * Admin client is used so RLS variations don't intermittently hide rows
 * from delegate-role users. The caller is still authenticated via the
 * SSR cookie before any data is returned.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only auth here.
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
    const peerUserIds = new Set<string>([user.id]);

    // ---- As delegate: pull authorizing provider + sibling delegates ----
    const { data: asDelegate } = await adminClient
      .from("delegations")
      .select("provider_id, providers:provider_id(user_id)")
      .eq("delegate_user_id", user.id)
      .eq("status", "active");

    const authorizingProviderIds: string[] = [];
    for (const row of asDelegate ?? []) {
      const r = row as {
        provider_id: string;
        providers:
          | { user_id?: string | null }
          | Array<{ user_id?: string | null }>
          | null;
      };
      if (r.provider_id) authorizingProviderIds.push(r.provider_id);
      const ap = Array.isArray(r.providers) ? r.providers[0] : r.providers;
      if (ap?.user_id) peerUserIds.add(ap.user_id);
    }

    if (authorizingProviderIds.length > 0) {
      const { data: siblings } = await adminClient
        .from("delegations")
        .select("delegate_user_id")
        .in("provider_id", authorizingProviderIds)
        .eq("status", "active");
      for (const s of siblings ?? []) {
        const id = (s as { delegate_user_id?: string | null }).delegate_user_id;
        if (id) peerUserIds.add(id);
      }
    }

    // ---- As provider: pull all of my active delegates ----
    const { data: selfProvider } = await adminClient
      .from("providers")
      .select("id, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const clinicProviderIds: string[] = [];
    if (selfProvider?.id) {
      clinicProviderIds.push((selfProvider as { id: string }).id);
      const { data: myDelegates } = await adminClient
        .from("delegations")
        .select("delegate_user_id")
        .eq("provider_id", (selfProvider as { id: string }).id)
        .eq("status", "active");
      for (const d of myDelegates ?? []) {
        const id = (d as { delegate_user_id?: string | null }).delegate_user_id;
        if (id) peerUserIds.add(id);
      }
    }

    // ---- Same-clinic providers (by company_name) ----
    // Mirrors EMR `resolveClinicProviderIds`: anyone whose providers row
    // shares the caller's company_name is on the same team. Empty/null
    // company_name is NOT a wildcard — only a non-blank trimmed match.
    const myCompany = (
      (selfProvider as { company_name?: string | null } | null)?.company_name ||
      ""
    ).trim();
    if (myCompany) {
      const { data: clinicMates } = await adminClient
        .from("providers")
        .select("id, user_id, company_name")
        .ilike("company_name", myCompany);
      for (const cm of clinicMates ?? []) {
        const row = cm as {
          id: string;
          user_id?: string | null;
          company_name?: string | null;
        };
        if ((row.company_name || "").trim().toLowerCase() !== myCompany.toLowerCase()) {
          continue;
        }
        if (row.user_id) peerUserIds.add(row.user_id);
        if (row.id && !clinicProviderIds.includes(row.id)) {
          clinicProviderIds.push(row.id);
        }
      }
      if (clinicProviderIds.length > 0) {
        const { data: clinicDelegates } = await adminClient
          .from("delegations")
          .select("delegate_user_id")
          .in("provider_id", clinicProviderIds)
          .eq("status", "active");
        for (const d of clinicDelegates ?? []) {
          const id = (d as { delegate_user_id?: string | null })
            .delegate_user_id;
          if (id) peerUserIds.add(id);
        }
      }
    }

    const peerIdList = Array.from(peerUserIds);

    const { data, error } = await adminClient
      .from("prescriptions")
      .select(
        `
        id,
        queue_id,
        submitted_at,
        medication,
        dosage,
        dosage_amount,
        dosage_unit,
        vial_size,
        form,
        quantity,
        refills,
        sig,
        dispense_as_written,
        pharmacy_notes,
        patient_price,
        profit_cents,
        consultation_reason,
        refill_frequency_days,
        shipping_fee_cents,
        total_paid_cents,
        status,
        payment_status,
        tracking_number,
        fedex_status,
        estimated_delivery,
        pharmacy_id,
        pdf_storage_path,
        patient_id,
        has_custom_address,
        custom_address,
        submitted_by_delegation_id,
        prescriber_id,
        patient:patients(first_name, last_name, date_of_birth, email, physical_address),
        pharmacy:pharmacies(name, primary_color),
        payment_transactions(id)
      `,
      )
      .in("prescriber_id", peerIdList)
      .eq("prescription_type", "prescription")
      .neq("status", "cancelled")
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    // Resolve prescriber display names server-side (May 19 2026, LifeMed
    // multi-login incident). MUST be done with the admin client here —
    // the client-side `providers` table is locked down by RLS
    // (`select_own_or_admin` + `select_active_delegate_supervisor`), so
    // a clinic seat like Lydia Cole CANNOT read Whipps's providers row
    // from the browser. Doing this lookup on the client would silently
    // degrade to "Unknown Provider" for every cross-seat row. Resolve
    // here with admin privileges and stamp `doctor_name` onto each row.
    const rows = data || [];
    const prescriberIds = Array.from(
      new Set(
        rows
          .map((r) => (r as { prescriber_id?: string | null }).prescriber_id)
          .filter((v): v is string => !!v),
      ),
    );
    const nameMap = new Map<string, string>();
    if (prescriberIds.length > 0) {
      const { data: providerRows } = await adminClient
        .from("providers")
        .select("user_id, prefix, first_name, last_name")
        .in("user_id", prescriberIds);
      for (const row of providerRows ?? []) {
        const r = row as {
          user_id: string;
          prefix: string | null;
          first_name: string | null;
          last_name: string | null;
        };
        const name = `${r.prefix || "Dr."} ${r.first_name ?? ""} ${r.last_name ?? ""}`
          .replace(/\s+/g, " ")
          .trim();
        if (r.user_id && name) nameMap.set(r.user_id, name);
      }
    }
    const decorated = rows.map((r) => {
      const pid = (r as { prescriber_id?: string | null }).prescriber_id;
      return {
        ...r,
        doctor_name: pid ? (nameMap.get(pid) ?? "Unknown Provider") : "Unknown Provider",
      };
    });

    return NextResponse.json({
      prescriptions: decorated,
      clinicPeerCount: peerIdList.length,
    });
  } catch (err) {
    console.error("GET /api/prescriptions/list failed:", err);
    return NextResponse.json(
      { error: "Failed to load prescriptions" },
      { status: 500 },
    );
  }
}
