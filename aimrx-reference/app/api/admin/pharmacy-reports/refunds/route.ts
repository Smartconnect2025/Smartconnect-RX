/**
 * Accounting & Refunds — list endpoint.
 *
 * Returns rejected/cancelled prescriptions joined with their
 * `prescription_refunds` row, grouped by pharmacy → provider → orders,
 * mirroring the shape of the main pharmacy-reports endpoint so the UI
 * can render a familiar grouped table.
 *
 * Admin / super_admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { ensureRefundRowsExist } from "./_shared/ensure-refund-rows";

const HIDDEN_TEST_LASTNAMES = ["harton"];
const HIDDEN_PROVIDER_LASTNAMES = ["sughayer", "providerassitant"];

interface RefundRow {
  id: string;
  prescription_id: string;
  status: "owed" | "issued" | "not_applicable";
  refund_amount_cents: number;
  refund_method: "card" | "pot_credit" | "none";
  issued_at: string | null;
  issued_by_user_id: string | null;
  note: string | null;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const pharmacyId = url.searchParams.get("pharmacyId");
    const delegationId = url.searchParams.get("delegationId");
    const providerId = url.searchParams.get("providerId"); // providers.id
    const statusFilter = url.searchParams.get("statusFilter") || "all"; // all | owed | issued | not_applicable
    const showResolved = url.searchParams.get("showResolved") === "true";

    const supabase = await createServerClient();

    // If a provider filter is supplied, resolve providers.id → user_id so we
    // can scope prescriptions.prescriber_id (which holds the auth user id).
    let prescriberIdFilter: string | null = null;
    if (providerId) {
      const { data: prov } = await supabase
        .from("providers")
        .select("user_id")
        .eq("id", providerId)
        .maybeSingle();
      prescriberIdFilter = (prov as { user_id?: string } | null)?.user_id || "__no_match__";
    }

    let rxQuery = supabase
      .from("prescriptions")
      .select("*")
      .in("status", ["rejected", "cancelled"]);

    if (startDate) rxQuery = rxQuery.gte("submitted_at", startDate);
    if (endDate) rxQuery = rxQuery.lte("submitted_at", endDate);
    if (pharmacyId) rxQuery = rxQuery.eq("pharmacy_id", pharmacyId);
    if (delegationId) rxQuery = rxQuery.eq("submitted_by_delegation_id", delegationId);
    if (prescriberIdFilter) rxQuery = rxQuery.eq("prescriber_id", prescriberIdFilter);

    const { data: prescriptions, error: rxErr } = await rxQuery;
    // Auto-classify any newly rejected/cancelled rx not yet backfilled.
    const fallbackRefunds = prescriptions?.length
      ? await ensureRefundRowsExist(supabase, prescriptions)
      : new Map();
    if (rxErr) {
      console.error("[refunds GET] prescriptions error:", rxErr);
      return NextResponse.json({ error: "Failed to load prescriptions", details: rxErr.message }, { status: 500 });
    }

    const rxIds = (prescriptions || []).map((p) => p.id);
    const prescriberIds = [...new Set((prescriptions || []).map((p) => p.prescriber_id).filter(Boolean))];
    const patientIds = [...new Set((prescriptions || []).map((p) => p.patient_id).filter(Boolean))];
    const pharmacyIds = [...new Set((prescriptions || []).map((p) => p.pharmacy_id).filter(Boolean))];
    const medicationIds = [...new Set((prescriptions || []).map((p) => p.medication_id).filter(Boolean))];

    type ProviderRow = { id: string; user_id: string; first_name: string; last_name: string; prefix: string | null; email: string; group_id: string | null; pay_on_terms: boolean };
    type PatientRow = { id: string; first_name: string; last_name: string; email: string | null };
    type PharmacyRow = { id: string; name: string };
    type MedicationRow = { id: string; name: string; strength: string | null; dosage_form: string | null };

    const [
      { data: refundRows },
      { data: providers },
      { data: patients },
      { data: pharmacies },
      { data: medications },
    ] = await Promise.all([
      rxIds.length
        ? supabase.from("prescription_refunds").select("*").in("prescription_id", rxIds)
        : Promise.resolve({ data: [] as RefundRow[] }),
      prescriberIds.length
        ? supabase.from("providers").select("id, user_id, first_name, last_name, prefix, email, group_id, pay_on_terms").in("user_id", prescriberIds)
        : Promise.resolve({ data: [] as ProviderRow[] }),
      patientIds.length
        ? supabase.from("patients").select("id, first_name, last_name, email").in("id", patientIds)
        : Promise.resolve({ data: [] as PatientRow[] }),
      pharmacyIds.length
        ? supabase.from("pharmacies").select("id, name").in("id", pharmacyIds)
        : Promise.resolve({ data: [] as PharmacyRow[] }),
      medicationIds.length
        ? supabase.from("pharmacy_medications").select("id, name, strength, dosage_form").in("id", medicationIds)
        : Promise.resolve({ data: [] as MedicationRow[] }),
    ]);

    // Resolve issuer email/name for any "issued" rows that have an
    // issued_by_user_id. Two-step because we needed refundRows first.
    const issuerIds = [
      ...new Set(((refundRows || []) as RefundRow[]).map((r) => r.issued_by_user_id).filter(Boolean) as string[]),
    ];
    let issuerMap = new Map<string, { id: string; email: string | null; name: string | null }>();
    if (issuerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", issuerIds);
      issuerMap = new Map(
        ((profiles as Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>) || []).map((u) => [
          u.id,
          { id: u.id, email: u.email, name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email },
        ]),
      );
    }
    const refundMap = new Map<string, RefundRow>(
      ((refundRows as RefundRow[]) || []).map((r) => [r.prescription_id, r]),
    );
    const providerMap = new Map<string, ProviderRow>(
      ((providers as ProviderRow[]) || []).map((p) => [p.user_id, p]),
    );
    const patientMap = new Map<string, PatientRow>(
      ((patients as PatientRow[]) || []).map((p) => [p.id, p]),
    );
    const pharmacyMap = new Map<string, PharmacyRow>(
      ((pharmacies as PharmacyRow[]) || []).map((p) => [p.id, p]),
    );
    const medicationMap = new Map<string, MedicationRow>(
      ((medications as MedicationRow[]) || []).map((m) => [m.id, m]),
    );

    type Order = {
      id: string;
      queue_id: string;
      date: string;
      patient: string;
      medication: string;
      quantity: number;
      refills: number;
      status: string;
      payment_status: string;
      refund: {
        id: string | null;
        status: "owed" | "issued" | "not_applicable";
        method: "card" | "pot_credit" | "none";
        amountCents: number;
        issuedAt: string | null;
        issuedBy: { name: string | null; email: string | null } | null;
        note: string | null;
      };
    };

    type ProviderGroup = {
      provider: { id: string; name: string; email: string; payOnTerms: boolean };
      orders: Order[];
      owedCents: number;
      owedCount: number;
      issuedCents: number;
      issuedCount: number;
    };

    type PharmacyGroup = {
      pharmacy: { id: string; name: string };
      providers: Record<string, ProviderGroup>;
      owedCents: number;
      issuedCents: number;
    };

    const reportData: Record<string, PharmacyGroup> = {};
    let totalOwedCents = 0;
    let totalIssuedCents = 0;
    let totalNotApplicable = 0;
    let cardOwedCents = 0;
    let potOwedCents = 0;
    // Spec KPIs: total dollar value of every rejected vs cancelled
    // prescription in scope (regardless of refund status). Computed from
    // the refund row's `refund_amount_cents` so they match what the
    // accounting team sees on each row.
    let totalRejectedCents = 0;
    let totalCancelledCents = 0;

    for (const rx of prescriptions || []) {
      const patient = patientMap.get(rx.patient_id);
      if (patient && HIDDEN_TEST_LASTNAMES.includes((patient.last_name || "").toLowerCase())) continue;
      const provider = providerMap.get(rx.prescriber_id);
      if (provider && HIDDEN_PROVIDER_LASTNAMES.includes((provider.last_name || "").toLowerCase())) continue;

      // Fail-open: use in-memory fallback if the row didn't persist.
      const persistedRefund = refundMap.get(rx.id);
      const fb = fallbackRefunds.get(rx.id);
      const refund: RefundRow | null = persistedRefund
        ? persistedRefund
        : fb
          ? {
              id: "", // empty PK → UI hides Mark Issued
              prescription_id: fb.prescription_id,
              status: fb.status,
              refund_amount_cents: fb.refund_amount_cents,
              refund_method: fb.refund_method,
              issued_at: fb.issued_at,
              issued_by_user_id: null,
              note: fb.note,
              updated_at: new Date().toISOString(),
            }
          : null;
      if (!refund) continue;

      // Always count toward the rejected/cancelled top-line KPIs BEFORE
      // applying the row-status filter, so the headline totals stay
      // stable regardless of which status filter the user picks.
      if (rx.status === "rejected") totalRejectedCents += refund.refund_amount_cents;
      else if (rx.status === "cancelled") totalCancelledCents += refund.refund_amount_cents;

      // Filter. When the caller explicitly picks a non-"owed" status
      // (e.g. statusFilter=issued) we honor it directly and ignore the
      // showResolved gate — otherwise the UI returns empty results when
      // someone picks "Issued only" but forgot to flip Show resolved.
      if (statusFilter !== "all") {
        if (refund.status !== statusFilter) continue;
      } else if (!showResolved && refund.status !== "owed") {
        continue;
      }

      const pharmId = rx.pharmacy_id || "unspecified";
      const pharm = pharmacyMap.get(pharmId);
      const pharmName = pharm?.name || "Not specified";

      if (!reportData[pharmId]) {
        reportData[pharmId] = {
          pharmacy: { id: pharmId, name: pharmName },
          providers: {},
          owedCents: 0,
          issuedCents: 0,
        };
      }

      const provId = provider?.id || "unspecified";
      const provName = provider
        ? `${provider.prefix || "Dr."} ${provider.first_name || ""} ${provider.last_name || ""}`.trim() || "Unknown Provider"
        : "Unknown Provider";

      if (!reportData[pharmId].providers[provId]) {
        reportData[pharmId].providers[provId] = {
          provider: {
            id: provId,
            name: provName,
            email: provider?.email || "",
            payOnTerms: !!provider?.pay_on_terms,
          },
          orders: [],
          owedCents: 0,
          owedCount: 0,
          issuedCents: 0,
          issuedCount: 0,
        };
      }

      const med = medicationMap.get(rx.medication_id);
      let medDisplay = "Unknown Medication";
      if (med) {
        medDisplay = med.name + (med.strength ? ` ${med.strength}` : "") + (med.dosage_form ? ` ${med.dosage_form}` : "");
      } else if (rx.medication) {
        medDisplay = rx.medication;
      }

      const issuer = refund.issued_by_user_id ? issuerMap.get(refund.issued_by_user_id) || null : null;

      const order: Order = {
        id: rx.id,
        queue_id: rx.queue_id || "",
        date: rx.submitted_at,
        patient: patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown Patient" : "Unknown Patient",
        medication: medDisplay,
        quantity: rx.quantity || 0,
        refills: rx.refills || 0,
        status: rx.status,
        payment_status: rx.payment_status || "unpaid",
        refund: {
          id: refund.id,
          status: refund.status,
          method: refund.refund_method,
          amountCents: refund.refund_amount_cents,
          issuedAt: refund.issued_at,
          issuedBy: issuer ? { name: issuer.name, email: issuer.email } : null,
          note: refund.note,
        },
      };

      reportData[pharmId].providers[provId].orders.push(order);

      if (refund.status === "owed") {
        reportData[pharmId].owedCents += refund.refund_amount_cents;
        reportData[pharmId].providers[provId].owedCents += refund.refund_amount_cents;
        reportData[pharmId].providers[provId].owedCount += 1;
        totalOwedCents += refund.refund_amount_cents;
        if (refund.refund_method === "card") cardOwedCents += refund.refund_amount_cents;
        if (refund.refund_method === "pot_credit") potOwedCents += refund.refund_amount_cents;
      } else if (refund.status === "issued") {
        reportData[pharmId].issuedCents += refund.refund_amount_cents;
        reportData[pharmId].providers[provId].issuedCents += refund.refund_amount_cents;
        reportData[pharmId].providers[provId].issuedCount += 1;
        totalIssuedCents += refund.refund_amount_cents;
      } else {
        totalNotApplicable += 1;
      }
    }

    const reports = Object.values(reportData)
      .map((p) => ({
        pharmacy: p.pharmacy,
        owedCents: p.owedCents,
        issuedCents: p.issuedCents,
        providers: Object.values(p.providers).sort((a, b) => b.owedCents - a.owedCents),
      }))
      .sort((a, b) => b.owedCents - a.owedCents);

    return NextResponse.json({
      reports,
      summary: {
        totalRejectedCents,
        totalCancelledCents,
        totalOwedCents,
        totalIssuedCents,
        totalNotApplicable,
        cardOwedCents,
        potOwedCents,
      },
    });
  } catch (error) {
    console.error("[refunds GET] Internal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
