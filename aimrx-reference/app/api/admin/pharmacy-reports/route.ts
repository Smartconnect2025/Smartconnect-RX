/**
 * Pharmacy Order Reports API
 *
 * Provides order statistics grouped by pharmacy and provider
 * with filtering by date range
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // Check if the current user is an admin
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

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const pharmacyId = searchParams.get("pharmacyId");
    // Optional: scope the report to prescriptions submitted by a single
    // assistant (delegate). Used by the admin Reporting & Analytics
    // "Provider" filter when an assistant is selected from the dropdown.
    // The report still groups under the supervising provider (legal
    // prescriber); this filter just narrows the input set.
    const delegationId = searchParams.get("delegationId");

    const supabase = await createServerClient();


    // Build query for prescriptions with provider and patient info
    // This fetches from the incoming prescriptions queue
    // Only include prescriptions with valid status (submitted, billing, approved, packed, shipped, delivered)
    let query = supabase
      .from("prescriptions")
      .select("*")
      // `paused` is Greenwich's "In Production" — actively-compounded
      // orders that have NOT been excluded from the reports tab. Leaving
      // it out made paused-but-active orders look like the report was
      // empty (May 21 2026, Joseph: "report is empty").
      .in("status", ["submitted", "billing", "approved", "paused", "packed", "shipped", "delivered"]);

    // Apply filters
    if (startDate) {
      query = query.gte("submitted_at", startDate);
    }
    if (endDate) {
      query = query.lte("submitted_at", endDate);
    }
    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }
    if (delegationId) {
      query = query.eq("submitted_by_delegation_id", delegationId);
    }

    query = query.order("submitted_at", { ascending: false });

    const { data: prescriptions, error } = await query;

    if (error) {
      console.error("Error fetching prescriptions:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: "Failed to fetch prescriptions", details: error.message },
        { status: 500 },
      );
    }

    // Return empty report if no prescriptions found
    if (!prescriptions || prescriptions.length === 0) {
      return NextResponse.json({
        success: true,
        report: [],
        totalPrescriptions: 0,
      });
    }

    // Fetch related data separately to avoid complex join issues
    const prescriberIds = [...new Set(prescriptions.map(p => p.prescriber_id).filter(Boolean))];
    const patientIds = [...new Set(prescriptions.map(p => p.patient_id).filter(Boolean))];
    const pharmacyIds = [...new Set(prescriptions.map(p => p.pharmacy_id).filter(Boolean))];
    const medicationIds = [...new Set(prescriptions.map(p => p.medication_id).filter(Boolean))];

    // Fetch providers (using user_id to match prescriber_id).
    // We surface provider-query errors explicitly — a silent null here
    // empties providerMap and the whole report renders blank (May 21
    // 2026 empty-report investigation). If `tier_level` somehow trips
    // the select (schema drift), retry without it so the report still
    // renders — tier breakdown just degrades to "—" for that run.
    let { data: providers, error: providersErr } = await supabase
      .from("providers")
      .select("id, user_id, prefix, first_name, last_name, email, group_id, pay_on_terms, tier_level")
      .in("user_id", prescriberIds);
    if (providersErr) {
      console.error("[pharmacy-reports] provider query failed:", providersErr.message);
      const retry = await supabase
        .from("providers")
        .select("id, user_id, prefix, first_name, last_name, email, group_id, pay_on_terms")
        .in("user_id", prescriberIds);
      if (retry.error) {
        return NextResponse.json(
          { error: `Failed to load providers: ${retry.error.message}` },
          { status: 500 },
        );
      }
      providers = (retry.data || []).map((p) => ({ ...p, tier_level: null }));
    }

    // Fetch tier discount table so we can attach the provider's tier name
    // and discount percentage to every order in the breakdown export.
    // Accountant needs to see WHERE the tier discount came from for tie-out.
    const { data: tierRows } = await supabase
      .from("tiers")
      .select("tier_name, discount_percentage");
    // Normalize tier keys so `Tier2` (tiers table) matches `tier02`
    // (providers.tier_level). Strip leading zeros after the "tier" prefix.
    const normalizeTierKey = (name: string | null | undefined): string =>
      String(name || "").toLowerCase().trim().replace(/^tier0+(\d)/, "tier$1");
    const tierPctByName = new Map<string, number>(
      (tierRows || []).map((t) => [
        normalizeTierKey(t.tier_name),
        Number(t.discount_percentage) || 0,
      ]),
    );

    // Fetch patients
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email")
      .in("id", patientIds);

    // Fetch pharmacies
    const { data: pharmacies } = await supabase
      .from("pharmacies")
      .select("id, name")
      .in("id", pharmacyIds);

    // Fetch medications
    const { data: medications } = await supabase
      .from("pharmacy_medications")
      .select("id, name, strength, dosage_form, aimrx_site_pricing_cents")
      .in("id", medicationIds);

    // Fetch the delegations referenced by these prescriptions so we can
    // attach the submitting assistant's display info to each order. An
    // order with no `submitted_by_delegation_id` was submitted directly
    // by the supervising provider — `submittedBy` will be null for it.
    const delegationIdsInUse = [
      ...new Set(
        prescriptions
          .map((p) => p.submitted_by_delegation_id)
          .filter((v): v is string => !!v),
      ),
    ];
    const { data: delegationRows } = delegationIdsInUse.length
      ? await supabase
          .from("delegations")
          .select("id, delegate_first_name, delegate_last_name, delegate_email")
          .in("id", delegationIdsInUse)
      : { data: [] as Array<{
          id: string;
          delegate_first_name: string;
          delegate_last_name: string;
          delegate_email: string;
        }> };
    const delegationMap = new Map(
      (delegationRows || []).map((d) => [d.id, d]),
    );

    // Fetch payment transactions to distinguish real card payments from
    // pay-on-terms auto-marked-paid orders. An rx with a payment_transaction
    // that has an authnet_transaction_id was actually charged on a card and
    // should NOT be billed to the provider on terms, even if the provider's
    // pay_on_terms flag is currently ON.
    const paymentTxnIds = [
      ...new Set(prescriptions.map((p) => p.payment_transaction_id).filter(Boolean)),
    ] as string[];
    let paymentTxns: { id: string; authnet_transaction_id: string | null }[] = [];
    if (paymentTxnIds.length > 0) {
      const { data: txns, error: txnErr } = await supabase
        .from("payment_transactions")
        .select("id, authnet_transaction_id")
        .in("id", paymentTxnIds);
      if (txnErr) {
        console.error("[pharmacy-reports] payment_transactions fetch failed:", txnErr);
        return NextResponse.json(
          {
            error:
              "Failed to load payment transactions for pay-on-terms classification",
            details: txnErr.message,
          },
          { status: 500 },
        );
      }
      paymentTxns = txns || [];
    }
    const txnHasAuthnet = new Map(
      paymentTxns.map((t) => [
        t.id,
        !!(t.authnet_transaction_id && String(t.authnet_transaction_id).trim() !== ""),
      ]),
    );
    const rxIdsWithCardCharge = new Set(
      prescriptions
        .filter(
          (p) => p.payment_transaction_id && txnHasAuthnet.get(p.payment_transaction_id),
        )
        .map((p) => p.id),
    );

    // Create lookup maps for quick access
    // Note: Map providers by user_id since prescriber_id is a user_id
    const providerMap = new Map(providers?.map(p => [p.user_id, p]) || []);
    const patientMap = new Map(patients?.map(p => [p.id, p]) || []);
    const pharmacyMap = new Map(pharmacies?.map(p => [p.id, p]) || []);
    const medicationMap = new Map(medications?.map(m => [m.id, m]) || []);

    // Group prescriptions by pharmacy and provider
    const reportData: Record<string, {
      pharmacy: { id: string; name: string };
      providers: Record<string, {
        provider: { id: string; name: string; email: string; group_id: string | null; payOnTerms: boolean };
        orders: Array<{
          id: string;
          queue_id: string;
          date: string;
          patient: string;
          medication: string;
          quantity: number;
          refills: number;
          sig: string;
          price: number;
          medicationPrice: number;
          providerFees: number;
          // ── Accountant breakdown fields (May 21 2026, Joseph) ────────
          // Each report row must let the accountant see exactly how the
          // final charged amount was built: catalog list price → tier
          // discount → net med price → provider extra fee → shipping →
          // total. Missing pieces (legacy rows, no catalog match) fall
          // back to 0 so the math still ties out.
          listPriceCents: number;
          tierName: string | null;
          tierDiscountPct: number;
          tierDiscountCents: number;
          netMedCents: number;
          providerFeeCents: number;
          shippingCents: number;
          totalChargedCents: number;
          status: string;
          payOnTerms: boolean;
          payOnTermsAmountCents: number;
          payOnTermsSettledAt: string | null;
          submittedBy: {
            delegationId: string;
            name: string;
            email: string;
          } | null;
        }>;
        totalOrders: number;
        totalAmount: number;
        totalMedicationAmount: number;
        totalProviderFees: number;
      }>;
      totalOrders: number;
      totalAmount: number;
    }> = {};

    const HIDDEN_TEST_LASTNAMES = ["harton"];
    const HIDDEN_PROVIDER_LASTNAMES = ["sughayer", "providerassitant"];
    const filteredPrescriptions = (prescriptions || []).filter((rx) => {
      const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
      if (patient) {
        const p = patient as { first_name: string; last_name: string };
        if (HIDDEN_TEST_LASTNAMES.includes(p.last_name?.toLowerCase())) return false;
      }
      const provider = providerMap.get(rx.prescriber_id);
      if (provider && HIDDEN_PROVIDER_LASTNAMES.includes(provider.last_name?.toLowerCase())) return false;
      return true;
    });

    filteredPrescriptions.forEach((prescription) => {
      try {
        const pharmacyId = prescription.pharmacy_id || "unspecified";
        const pharmacy = pharmacyMap.get(pharmacyId);
        const pharmacyName = pharmacy?.name || "Not specified";

        // prescriber_id is a user_id, so look up provider by user_id
        const prescriberId = prescription.prescriber_id || "unspecified";
        const provider = providerMap.get(prescriberId);
        const providerId = provider?.id || "unspecified"; // Get actual provider.id for grouping
        const providerName = provider
          ? `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name || ""} ${provider.last_name || ""}`.trim() || "Unknown Provider"
          : "Unknown Provider";
        const providerEmail = provider?.email || "";

        // Initialize pharmacy if not exists
        if (!reportData[pharmacyId]) {
          reportData[pharmacyId] = {
            pharmacy: { id: pharmacyId, name: pharmacyName },
            providers: {},
            totalOrders: 0,
            totalAmount: 0,
          };
        }

        // Initialize provider if not exists (group by provider.id)
        if (!reportData[pharmacyId].providers[providerId]) {
          reportData[pharmacyId].providers[providerId] = {
            provider: {
              id: providerId,
              name: providerName,
              email: providerEmail,
              group_id: provider?.group_id || null,
              payOnTerms: !!provider?.pay_on_terms,
            },
            orders: [],
            totalOrders: 0,
            totalAmount: 0,
            totalMedicationAmount: 0,
            totalProviderFees: 0,
          };
        }

        // Calculate medication price and provider fees separately
        const medicationPriceCents = prescription.total_paid_cents || 0;
        const providerFeeCents = prescription.profit_cents || 0;
        const medicationPriceInDollars = medicationPriceCents / 100;
        const providerFeesInDollars = providerFeeCents / 100;

        // If no total_paid_cents, fall back to patient_price (legacy)
        const finalMedicationPrice = prescription.total_paid_cents
          ? medicationPriceInDollars
          : (prescription.patient_price ? parseFloat(prescription.patient_price) : 0);

        const finalProviderFees = providerFeesInDollars;
        const finalTotalPrice = finalMedicationPrice + finalProviderFees;

        // ── Accountant breakdown (May 21 2026) ───────────────────────────
        // Reconstruct the price stack so every report row shows where the
        // dollars came from. Sources:
        //   - List price → catalog `pharmacy_medications.price_cents` (the
        //     pharmacy's pre-discount price).
        //   - Tier discount % → `tiers.discount_percentage` keyed by the
        //     provider's `tier_level`. Unknown / unset tier → 0%.
        //   - Net med price → prescription.patient_price (what the patient
        //     paid for the drug after the provider's tier discount).
        //   - Provider fee → prescription.profit_cents (provider markup).
        //   - Shipping → prescription.shipping_fee_cents.
        //   - Total charged → net med + provider fee + shipping (cents).
        // Legacy rows with no catalog match show list = net med and
        // discount = 0 so the math still ties out.
        const catalogMed = medicationMap.get(prescription.medication_id);
        const netMedCents = prescription.patient_price
          ? Math.round(parseFloat(prescription.patient_price) * 100)
          : 0;
        const tierName = provider?.tier_level || null;
        const tierDiscountPct = tierName
          ? tierPctByName.get(normalizeTierKey(tierName)) || 0
          : 0;
        const catalogListCents =
          (catalogMed as { aimrx_site_pricing_cents?: number | null } | undefined)
            ?.aimrx_site_pricing_cents || 0;
        // Tie-out guarantee: list - discount = net for every row.
        // Preference order:
        //   1) Catalog list present → list = catalog, discount = list - net.
        //   2) Catalog missing but tier % > 0 and net > 0 → derive list from
        //      tier %: list = round(net / (1 - pct/100)). This guarantees the
        //      accountant ALWAYS sees a visible discount on tier'd rows
        //      (Joseph: "amount on display, discount tier amount, amount
        //      after discount" — May 21 2026).
        //   3) Neither → list = net, discount = 0.
        const hasCatalogList = catalogListCents > 0;
        let listPriceCents: number;
        let tierDiscountCents: number;
        if (hasCatalogList) {
          listPriceCents = catalogListCents;
          tierDiscountCents = Math.max(0, listPriceCents - netMedCents);
        } else if (tierDiscountPct > 0 && netMedCents > 0 && tierDiscountPct < 100) {
          listPriceCents = Math.round(netMedCents / (1 - tierDiscountPct / 100));
          tierDiscountCents = Math.max(0, listPriceCents - netMedCents);
        } else {
          listPriceCents = netMedCents;
          tierDiscountCents = 0;
        }
        const shippingCents = prescription.shipping_fee_cents || 0;
        const totalChargedCents =
          netMedCents + (prescription.profit_cents || 0) + shippingCents;

        const patient = patientMap.get(prescription.patient_id);
        const medication = medicationMap.get(prescription.medication_id);

        // Build medication display name with strength and form
        let medicationDisplay = "Unknown Medication";
        if (medication) {
          medicationDisplay = medication.name;
          if (medication.strength) {
            medicationDisplay += ` ${medication.strength}`;
          }
          if (medication.dosage_form) {
            medicationDisplay += ` ${medication.dosage_form}`;
          }
        } else if (prescription.medication) {
          // Fall back to legacy medication field if medication_id lookup fails
          medicationDisplay = prescription.medication;
        }

        // Pay-on-Terms fields (per-row)
        // Bill basis = round(patient_price*100) + coalesce(shipping_fee_cents,0)
        const patientPriceCents = prescription.patient_price
          ? Math.round(parseFloat(prescription.patient_price) * 100)
          : 0;
        const shippingFeeCents = prescription.shipping_fee_cents || 0;
        const payOnTermsAmountCents = patientPriceCents + shippingFeeCents;
        // A row is "Payment on Terms" only if the provider is currently on
        // terms AND the order was NOT actually charged on a card. Orders with
        // an authnet_transaction_id were paid by patient card and should not
        // be billed back to the provider on terms.
        const isPayOnTerms =
          !!provider?.pay_on_terms && !rxIdsWithCardCharge.has(prescription.id);

        // Resolve the assistant who submitted this rx, if any. When the
        // supervising provider submits directly, `submitted_by_delegation_id`
        // is null and `submittedBy` is left null on the order.
        const submitterDelegation = prescription.submitted_by_delegation_id
          ? delegationMap.get(prescription.submitted_by_delegation_id)
          : null;
        const submittedBy = submitterDelegation
          ? {
              delegationId: submitterDelegation.id,
              name:
                `${submitterDelegation.delegate_first_name || ""} ${submitterDelegation.delegate_last_name || ""}`.trim() ||
                submitterDelegation.delegate_email ||
                "Unknown Assistant",
              email: submitterDelegation.delegate_email || "",
            }
          : null;

        // Add order to provider
        reportData[pharmacyId].providers[providerId].orders.push({
          id: prescription.id,
          queue_id: prescription.queue_id || "",
          date: prescription.submitted_at,
          patient: patient
            ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown Patient"
            : "Unknown Patient",
          medication: medicationDisplay,
          quantity: prescription.quantity || 0,
          refills: prescription.refills || 0,
          sig: prescription.sig || "",
          price: finalTotalPrice,
          medicationPrice: finalMedicationPrice,
          providerFees: finalProviderFees,
          listPriceCents,
          tierName,
          tierDiscountPct,
          tierDiscountCents,
          netMedCents,
          providerFeeCents,
          shippingCents,
          totalChargedCents,
          status: prescription.status,
          payOnTerms: isPayOnTerms,
          payOnTermsAmountCents,
          payOnTermsSettledAt: prescription.pay_on_terms_settled_at || null,
          submittedBy,
        });

        // Update totals
        reportData[pharmacyId].providers[providerId].totalOrders++;
        reportData[pharmacyId].providers[providerId].totalAmount += finalTotalPrice;
        reportData[pharmacyId].providers[providerId].totalMedicationAmount += finalMedicationPrice;
        reportData[pharmacyId].providers[providerId].totalProviderFees += finalProviderFees;
        reportData[pharmacyId].totalOrders++;
        reportData[pharmacyId].totalAmount += finalTotalPrice;
      } catch (prescriptionError) {
        console.error("Error processing prescription:", prescription.id, prescriptionError);
        // Continue with next prescription
      }
    });

    // Convert to array format
    const report = Object.values(reportData).map((pharmacy) => ({
      ...pharmacy,
      providers: Object.values(pharmacy.providers),
    }));

    return NextResponse.json({
      success: true,
      report,
      totalPrescriptions: prescriptions?.length || 0,
    });
  } catch (error) {
    console.error("Error generating pharmacy reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
