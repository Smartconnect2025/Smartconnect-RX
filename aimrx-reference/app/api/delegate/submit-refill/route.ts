import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { checkProviderActive } from "@/core/auth/check-provider-active";
import {
  requireNonDemo,
  createGuardErrorResponse,
} from "@core/auth/api-guards";
import { getEffectiveTierDiscountForUser } from "@core/services/pricing/tierDiscountService";

/**
 * POST /api/delegate/submit-refill
 *
 * Body: { parent_prescription_id: string }
 *
 * Provider Assistance — simple model
 * ----------------------------------
 * The assistant submits refills exactly the same way she submits new
 * prescriptions: she IS the prescriber on her own row (prescriber_id =
 * delegate's user.id). The ONLY differences vs a regular provider:
 *
 *   1. The authorizing provider's `is_active` is rechecked at submit time.
 *   2. The delegation's `scope_refills` flag must be true.
 *   3. submitted_by_delegation_id is stamped for audit.
 *
 * Patient access flows entirely through the assistant's own
 * `provider_patient_mappings` rows, which the clinic-sharing trigger
 * keeps in sync with every other provider/assistant in the same
 * `company_name` group.
 *
 * The pharmacy / outgoing PDF identifies the legal prescriber by the
 * AUTHORIZING provider's name and NPI (the same stamping the new-Rx
 * submit endpoint applies). For refills, the parent prescription already
 * carries a snapshot of those fields via prescription history; we don't
 * need to re-stamp here.
 */
export async function POST(request: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "delegate") {
    return NextResponse.json(
      { success: false, error: "Delegate access required" },
      { status: 403 },
    );
  }

  const demoCheck = await requireNonDemo();
  if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

  let body: { parent_prescription_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.parent_prescription_id) {
    return NextResponse.json(
      { success: false, error: "parent_prescription_id is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // 1. Look up the assistant's active delegation. We do NOT trust any
  // body field for this — the assistant's identity is the only input
  // we need.
  const { data: delegation, error: delErr } = await supabase
    .from("delegations")
    .select(
      "id, scope_refills, providers:provider_id(user_id, is_active)",
    )
    .eq("delegate_user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (delErr) {
    return NextResponse.json(
      { success: false, error: "Authorization check failed" },
      { status: 500 },
    );
  }
  if (!delegation) {
    return NextResponse.json(
      {
        success: false,
        error:
          "You have no active authorization. Contact your authorizing provider or AimRx support.",
      },
      { status: 403 },
    );
  }
  if (!delegation.scope_refills) {
    return NextResponse.json(
      { success: false, error: "Your authorization does not include refills." },
      { status: 403 },
    );
  }

  const authProvider = Array.isArray(delegation.providers)
    ? delegation.providers[0]
    : (delegation.providers as {
        user_id?: string | null;
        is_active?: boolean | null;
      } | null);

  if (!authProvider?.user_id) {
    return NextResponse.json(
      { success: false, error: "Authorizing provider record is invalid." },
      { status: 409 },
    );
  }

  // 2. Authorizing provider must still be active (parallels submit/route.ts)
  const isActive = await checkProviderActive(authProvider.user_id);
  if (!isActive) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Your authorizing provider's account is inactive. Submissions are paused until the provider is reactivated.",
      },
      { status: 403 },
    );
  }

  // 3. Look up the assistant's OWN providers row (the clinic-sharing
  // trigger keeps her panel in sync with the rest of her clinic).
  const { data: assistantProvider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assistantProvider?.id) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Your assistant provider profile is missing. Contact AimRx support.",
      },
      { status: 409 },
    );
  }

  // 4. Load the parent prescription. The assistant must have access to
  // the patient via her own panel — that is the only access invariant
  // in the simple model. The parent does NOT need to have been written
  // by the authorizing provider; clinic-shared patients are fair game.
  const { data: parent, error: parentErr } = await supabase
    .from("prescriptions")
    .select(
      `id, prescriber_id, patient_id, medication, dosage, dosage_amount,
       dosage_unit, vial_size, form, quantity, refills, sig,
       dispense_as_written, pharmacy_notes, pharmacy_id, medication_id,
       profit_cents, consultation_reason, refill_frequency_days,
       prescription_type, status, total_refills_to_date,
       has_custom_address, custom_address`,
    )
    .eq("id", body.parent_prescription_id)
    .maybeSingle();

  if (parentErr || !parent) {
    return NextResponse.json(
      { success: false, error: "Original prescription not found" },
      { status: 404 },
    );
  }
  if (parent.prescription_type !== "prescription") {
    return NextResponse.json(
      {
        success: false,
        error: "Only original prescriptions can be refilled",
      },
      { status: 400 },
    );
  }
  if (!parent.refills || parent.refills <= 0) {
    return NextResponse.json(
      { success: false, error: "No refills authorized on this prescription" },
      { status: 400 },
    );
  }
  if (parent.status === "cancelled") {
    return NextResponse.json(
      { success: false, error: "This prescription has been cancelled" },
      { status: 400 },
    );
  }
  if (!parent.pharmacy_id) {
    return NextResponse.json(
      {
        success: false,
        error: "Original prescription has no pharmacy on file — cannot refill",
      },
      { status: 400 },
    );
  }

  // 5. Patient must be accessible to this delegate. Access is granted
  // through the AUTHORIZING provider's panel — the entire purpose of a
  // delegation is that the assistant acts on behalf of the supervising
  // provider, so every patient on that provider's panel is fair game.
  // (Was previously checked against the assistant's own provider row,
  // which silently 403'd whenever the clinic-share trigger hadn't
  // populated her row — exactly the May 13 2026 Cather/Whipps incident.)
  // Check BEFORE the CAS so a denied request never burns a refill slot.
  // Fail-closed: never silently fall back to the assistant's own provider
  // row if the authorizing provider lookup fails — that would re-introduce
  // the inverse of the Cather/Whipps bug.
  const { data: authProviderRow, error: authProviderErr } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", authProvider.user_id)
    .maybeSingle();
  if (authProviderErr || !authProviderRow?.id) {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name: user.email ?? "delegate",
      action: "DELEGATE_REFILL_AUTH_PROVIDER_ROW_LOOKUP_FAILED",
      details:
        `delegationId=${delegation.id} ` +
        `authProviderUserId=${authProvider.user_id} ` +
        `error=${authProviderErr?.message ?? "no_row"}`,
      status: "error",
    });
    return NextResponse.json(
      {
        success: false,
        error:
          "Authorizing provider record could not be loaded. Contact AimRx support.",
      },
      { status: 409 },
    );
  }
  const mappingProviderId = authProviderRow.id;

  const { data: mappingPre } = await supabase
    .from("provider_patient_mappings")
    .select("id")
    .eq("provider_id", mappingProviderId)
    .eq("patient_id", parent.patient_id)
    .maybeSingle();
  if (!mappingPre) {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name: user.email ?? "delegate",
      action: "DELEGATE_REFILL_PATIENT_ACCESS_DENIED",
      details:
        `delegateUserId=${user.id} ` +
        `authProviderUserId=${authProvider.user_id} ` +
        `mappingProviderId=${mappingProviderId} ` +
        `patientId=${parent.patient_id} ` +
        `parentPrescriptionId=${parent.id}`,
      status: "error",
    });
    return NextResponse.json(
      { success: false, error: "You do not have access to this patient" },
      { status: 403 },
    );
  }

  // ----- Atomic refill-slot reservation (race-safe) -----
  const { data: reservation, error: casErr } = await supabase
    .from("prescriptions")
    .update({
      total_refills_to_date: (parent.total_refills_to_date ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parent.id)
    .eq("prescription_type", "prescription")
    .neq("status", "cancelled")
    .eq("total_refills_to_date", parent.total_refills_to_date ?? 0)
    .lt("total_refills_to_date", parent.refills)
    .select("id, total_refills_to_date")
    .maybeSingle();

  if (casErr) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reserve refill slot",
        details: casErr.message,
      },
      { status: 500 },
    );
  }
  if (!reservation) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No refill slot available — another submission may have used the last refill. Refresh and try again.",
      },
      { status: 409 },
    );
  }

  // 6. Re-enforce pricing from catalog (delegate cannot influence price).
  //    Apply the AUTHORISING provider's tier discount — the assistant's own
  //    providers row almost never has tier_level set, and parent.prescriber_id
  //    on a refill submitted by the assistant points at the assistant herself
  //    (simple model). The cart UI showed the discounted price; the saved
  //    patient_price must match. INCIDENT Apr 24, 2026.
  const tierLookupUserId = authProvider.user_id;
  let enforcedPriceDollars: string | null = null;
  if (parent.medication_id && tierLookupUserId) {
    const { data: medRow } = await supabase
      .from("pharmacy_medications")
      .select("aimrx_site_pricing_cents, retail_price_cents, notes")
      .eq("id", parent.medication_id)
      .maybeSingle();
    // Mirror the catalog-price fallback chain that /api/provider/pharmacy uses
    // (defensive against a Supabase schema-cache miss on the aimrx column).
    let catalogCents: number | null = null;
    if (medRow) {
      if (
        medRow.aimrx_site_pricing_cents != null &&
        Number.isFinite(Number(medRow.aimrx_site_pricing_cents))
      ) {
        catalogCents = Number(medRow.aimrx_site_pricing_cents);
      } else if (medRow.notes) {
        const fromNotes = parseInt(String(medRow.notes), 10);
        if (Number.isFinite(fromNotes)) catalogCents = fromNotes;
      } else if (
        medRow.retail_price_cents != null &&
        Number.isFinite(Number(medRow.retail_price_cents))
      ) {
        catalogCents = Number(medRow.retail_price_cents);
      }
    }
    if (catalogCents != null && catalogCents > 0) {
      let discountPct = 0;
      try {
        // Use the EFFECTIVE tier helper: the assistant's own tier wins
        // (so a per-assistant tier override set by admin / supervising
        // provider takes effect), falling back to the supervising
        // provider's tier when no override is set. Pass the AUTH user.id
        // (not tierLookupUserId) because the helper does the
        // assistant→supervisor fallback internally.
        const tier = await getEffectiveTierDiscountForUser(supabase, user.id);
        if (
          Number.isFinite(tier.discountPercentage) &&
          tier.discountPercentage >= 0 &&
          tier.discountPercentage <= 100
        ) {
          discountPct = tier.discountPercentage;
        }
      } catch (err) {
        console.error(
          "[delegate/submit-refill][TIER_LOOKUP_THROW] tier discount lookup threw — falling back to 0%.",
          "callerUserId=", user.id,
          "tierLookupUserId=", tierLookupUserId,
          "err=", err instanceof Error ? err.message : err,
        );
        discountPct = 0;
      }
      if (discountPct === 0) {
        const { data: provCheck } = await supabase
          .from("providers")
          .select("tier_level")
          .eq("user_id", tierLookupUserId)
          .maybeSingle();
        if (provCheck?.tier_level) {
          console.error(
            "[delegate/submit-refill][TIER_LOOKUP_MISMATCH] authorising provider has tier_level but resolved discount=0%.",
            "tierLookupUserId=", tierLookupUserId,
            "tier_level=", JSON.stringify(provCheck.tier_level),
            "parent_rx=", parent.id,
          );
        }
      }
      const discountedUnitCents =
        discountPct > 0
          ? Math.round(catalogCents * (1 - discountPct / 100))
          : catalogCents;
      const unitDollars = discountedUnitCents / 100;
      const totalDollars = unitDollars * (parent.quantity || 1);
      enforcedPriceDollars = totalDollars.toFixed(2);
    }
  }

  // 7. Re-enforce shipping from pharmacy profile
  let shippingCents = 0;
  {
    const { data: pharmacyRow } = await supabase
      .from("pharmacies")
      .select("shipping_fee_cents")
      .eq("id", parent.pharmacy_id)
      .maybeSingle();
    const v =
      pharmacyRow?.shipping_fee_cents != null
        ? Number(pharmacyRow.shipping_fee_cents)
        : 2500;
    shippingCents = Number.isFinite(v) ? v : 2500;
  }

  const medCents = enforcedPriceDollars
    ? Math.round(parseFloat(enforcedPriceDollars) * 100)
    : 0;
  const totalCents = medCents + (parent.profit_cents || 0) + shippingCents;

  // 8. Insert the refill — prescriber_id = the assistant herself
  // (simple model). The authorizing provider's identity is recorded
  // via submitted_by_delegation_id and applied as the outgoing-Rx
  // stamp by the PDF / pharmacy export layer.
  const { data: refill, error: insertErr } = await supabase
    .from("prescriptions")
    .insert({
      prescriber_id: user.id,
      patient_id: parent.patient_id,
      medication: parent.medication,
      dosage: parent.dosage,
      dosage_amount: parent.dosage_amount,
      dosage_unit: parent.dosage_unit,
      vial_size: parent.vial_size,
      form: parent.form,
      quantity: parent.quantity,
      refills: 0,
      sig: parent.sig,
      dispense_as_written: parent.dispense_as_written ?? false,
      pharmacy_notes: parent.pharmacy_notes,
      patient_price: enforcedPriceDollars,
      pharmacy_id: parent.pharmacy_id,
      medication_id: parent.medication_id,
      profit_cents: parent.profit_cents ?? 0,
      consultation_reason: parent.consultation_reason,
      shipping_fee_cents: shippingCents,
      total_paid_cents: totalCents,
      prescription_type: "refill",
      parent_prescription_id: parent.id,
      refill_frequency_days: parent.refill_frequency_days,
      has_custom_address: parent.has_custom_address ?? false,
      custom_address: parent.custom_address ?? null,
      status: "pending_payment",
      payment_status: "pending",
      submitted_by_delegation_id: delegation.id,
    })
    .select("id")
    .single();

  if (insertErr || !refill) {
    console.error("[delegate submit-refill] insert error:", insertErr);
    const { error: rollbackErr } = await supabase
      .from("prescriptions")
      .update({
        total_refills_to_date: parent.total_refills_to_date ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parent.id)
      .eq("total_refills_to_date", reservation.total_refills_to_date);
    if (rollbackErr) {
      console.error(
        "[delegate submit-refill] failed to roll back refill slot:",
        rollbackErr,
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create refill",
        details: insertErr?.message,
      },
      { status: 500 },
    );
  }

  // 9. Audit log
  await supabase.from("system_logs").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    user_name: `Assistant ${user.email ?? user.id}`,
    action: "DELEGATE_REFILL_SUBMITTED",
    details: `Delegation ${delegation.id} submitted refill of prescription ${parent.id} on behalf of authorizing provider ${authProvider.user_id}. New Rx: ${refill.id}`,
    status: "success",
  });

  return NextResponse.json(
    {
      success: true,
      message: "Refill submitted",
      prescription_id: refill.id,
    },
    { status: 201 },
  );
}
