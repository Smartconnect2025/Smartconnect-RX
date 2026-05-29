/**
 * Accounting & Refunds — CSV export.
 *
 * Streams a flat CSV of every rejected/cancelled prescription with its
 * refund classification, suitable for the accounting team to import into
 * QuickBooks or Excel. Honors the same filters as the GET list route.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { ensureRefundRowsExist } from "../_shared/ensure-refund-rows";

const HIDDEN_TEST_LASTNAMES = ["harton"];
const HIDDEN_PROVIDER_LASTNAMES = ["sughayer", "providerassitant"];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const pharmacyId = url.searchParams.get("pharmacyId");
    const delegationId = url.searchParams.get("delegationId");
    const providerId = url.searchParams.get("providerId");
    const statusFilter = url.searchParams.get("statusFilter") || "all";
    // Mirror the GET list route exactly: when the caller leaves
    // statusFilter=all and showResolved=false the on-screen tab only shows
    // owed rows, so the CSV must too. Otherwise accounting opens the
    // export and sees historical issued/N/A rows they can't see in the UI.
    const showResolved = url.searchParams.get("showResolved") === "true";

    const supabase = await createServerClient();

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

    const { data: prescriptions, error } = await rxQuery;
    const fallbackRefunds = prescriptions?.length
      ? await ensureRefundRowsExist(supabase, prescriptions)
      : new Map();
    if (error) {
      console.error("[refunds export] error:", error);
      return NextResponse.json({ error: "Failed to load prescriptions", details: error.message }, { status: 500 });
    }

    const rxIds = (prescriptions || []).map((p) => p.id);
    const prescriberIds = [...new Set((prescriptions || []).map((p) => p.prescriber_id).filter(Boolean))];
    const patientIds = [...new Set((prescriptions || []).map((p) => p.patient_id).filter(Boolean))];
    const pharmacyIds = [...new Set((prescriptions || []).map((p) => p.pharmacy_id).filter(Boolean))];
    const medicationIds = [...new Set((prescriptions || []).map((p) => p.medication_id).filter(Boolean))];

    type RefundRow = { prescription_id: string; status: string; refund_method: string; refund_amount_cents: number; issued_at: string | null; note: string | null };
    type ProviderRow = { user_id: string; first_name: string; last_name: string; prefix: string | null; email: string };
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
        ? supabase.from("providers").select("user_id, first_name, last_name, prefix, email").in("user_id", prescriberIds)
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

    const headers = [
      "Rx ID",
      "Queue ID",
      "Submitted Date",
      "Rx Status",
      "Payment Status",
      "Patient Name",
      "Patient Email",
      "Provider",
      "Provider Email",
      "Pharmacy",
      "Medication",
      "Amount (USD)",
      "Payment Method",
      "Refund Status",
      "Refunded At",
      "Refund Note",
      "Payment Transaction ID",
    ];
    const lines: string[] = [headers.map(csvEscape).join(",")];

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
              prescription_id: fb.prescription_id,
              status: fb.status,
              refund_method: fb.refund_method,
              refund_amount_cents: fb.refund_amount_cents,
              issued_at: fb.issued_at,
              note: fb.note,
            }
          : null;
      if (!refund) continue;
      // Match the GET list route's filter semantics exactly so the CSV
      // is always a superset/equivalent of what the user sees on screen.
      if (statusFilter !== "all") {
        if (refund.status !== statusFilter) continue;
      } else if (!showResolved && refund.status !== "owed") {
        continue;
      }

      const pharm = pharmacyMap.get(rx.pharmacy_id);
      const providerName = provider
        ? `${provider.prefix || "Dr."} ${provider.first_name || ""} ${provider.last_name || ""}`.trim()
        : "Unknown Provider";
      const patientName = patient
        ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim()
        : "Unknown Patient";

      const med = medicationMap.get(rx.medication_id);
      const medDisplay = med
        ? med.name + (med.strength ? ` ${med.strength}` : "") + (med.dosage_form ? ` ${med.dosage_form}` : "")
        : (rx.medication || "");

      lines.push(
        [
          rx.id,
          rx.queue_id || "",
          rx.submitted_at ? new Date(rx.submitted_at).toISOString().slice(0, 10) : "",
          rx.status || "",
          rx.payment_status || "",
          patientName,
          patient?.email || "",
          providerName,
          provider?.email || "",
          pharm?.name || "",
          medDisplay,
          (refund.refund_amount_cents / 100).toFixed(2),
          refund.refund_method,
          refund.status,
          refund.issued_at || "",
          refund.note || "",
          rx.payment_transaction_id || "",
        ].map(csvEscape).join(","),
      );
    }

    const csv = lines.join("\n") + "\n";
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smartconnect-refunds-${today}.csv"`,
      },
    });
  } catch (error) {
    console.error("[refunds export] Internal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
