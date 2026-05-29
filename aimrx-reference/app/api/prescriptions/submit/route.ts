import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { checkProviderActive } from "@/core/auth/check-provider-active";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";
import { getEffectiveTierDiscountForUser } from "@core/services/pricing/tierDiscountService";

/**
 * Prescription Creation API
 *
 * Creates a prescription record in pending_payment status.
 * Pharmacy submission is handled by submit-to-pharmacy after payment is confirmed.
 */

interface SubmitPrescriptionRequest {
  prescriber_id: string;
  patient_id: string;
  encounter_id?: string;
  appointment_id?: string;
  medication: string;
  dosage: string; // Legacy field: combined amount+unit (e.g., "10mg")
  dosage_amount?: string; // New structured field: numeric amount (e.g., "10")
  dosage_unit?: string; // New structured field: unit (e.g., "mg")
  vial_size?: string;
  form?: string;
  quantity: number;
  refills: number;
  sig: string;
  dispense_as_written?: boolean;
  pharmacy_notes?: string;
  patient_price?: string;
  pharmacy_id?: string;
  medication_id?: string;
  profit_cents?: number; // Provider oversight/monitoring fees in cents
  consultation_reason?: string; // Reason for the consultation fee
  shipping_fee_cents?: number; // Shipping fee in cents
  submission_group_id?: string; // Groups items submitted together in one cart
  refill_frequency_days?: number; // Days between refills
  prescription_type?: "prescription" | "refill";
  parent_prescription_id?: string;
  delivery_method?: string; // "shipping" | "pickup"
  has_custom_address?: boolean;
  custom_address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } | null;
  patient: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    phone?: string;
    email?: string;
  };
  prescriber: {
    prefix?: string | null;
    first_name: string;
    last_name: string;
    npi?: string;
    dea?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is a provider
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (
      !userRole ||
      (userRole !== "provider" &&
        userRole !== "admin" &&
        userRole !== "delegate")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only providers, admins, and authorized assistants can submit prescriptions",
        },
        { status: 403 },
      );
    }

    // Check if provider is active before allowing prescription submission
    if (userRole === "provider") {
      const isActive = await checkProviderActive(user.id);
      if (!isActive) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your account is inactive. Please contact administrator to activate your account.",
          },
          { status: 403 },
        );
      }
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body: SubmitPrescriptionRequest = await request.json();

    // Task #65: client-supplied body.prescriber (name + NPI + DEA) is
    // ADVISORY ONLY. The legal prescriber identity that ends up on the
    // outgoing PDF and DigitalRx Doctor block is always re-resolved
    // server-side from the providers table via the shared resolver
    // below (resolveAuthorizingProvider), so a stale or tampered client
    // payload cannot reintroduce the Manning placeholder-NPI bug.

    // For providers AND delegates (Provider Assistants), force prescriber_id
    // to the caller's own user.id — assistants act as their own provider row
    // and the authorizing provider's name + NPI is overlaid lower down for
    // the outgoing Rx. For admins, allow the submitted prescriber_id
    // (admin-assisted submissions).
    if (userRole === "provider" || userRole === "delegate") {
      body.prescriber_id = user.id;
    }

    // ----- Provider Assistance (simple model) -----
    // The assistant is provisioned as a regular provider row of her own and
    // submits Rx exactly like a provider would: prescriber_id = her own
    // user.id, her own provider record, her own (auto-shared) patient panel.
    //
    // The ONLY differences applied here:
    //   1. The authorizing provider must still be active at submit time.
    //   2. We stamp `submitted_by_delegation_id` for audit so the link
    //      between assistant and authorizing provider is permanent.
    //   3. The outgoing `body.prescriber` (name + NPI) is overridden with
    //      the AUTHORIZING provider's data, because the authorizing provider
    //      is the legal prescriber on the outgoing prescription.
    let submittedByDelegationId: string | null = null;
    let assistantNameForAudit: string | null = null;
    // The user_id whose tier should drive the discount. For delegate
    // submissions this MUST be the authorising provider, NOT the assistant
    // (whose own providers row has no tier_level). Captured from the
    // delegation lookup below. For direct provider submissions it stays null
    // and we fall back to body.prescriber_id.
    let authorisingProviderUserId: string | null = null;

    if (userRole === "delegate") {
      // Force prescriber_id = the assistant's own user.id (defence in depth
      // against a client that tries to pose as someone else).
      body.prescriber_id = user.id;

      const supabaseLookup = createAdminClient();
      const { data: delegation, error: delErr } = await supabaseLookup
        .from("delegations")
        .select(
          "id, scope_refills, scope_new_rx, providers:provider_id(user_id, is_active, prefix, first_name, last_name, npi_number)",
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

      // Scope check
      const isRefill = body.prescription_type === "refill";
      if (isRefill && !delegation.scope_refills) {
        return NextResponse.json(
          { success: false, error: "Your authorization does not include refills." },
          { status: 403 },
        );
      }
      if (!isRefill && !delegation.scope_new_rx) {
        return NextResponse.json(
          {
            success: false,
            error: "Your authorization does not include new prescriptions.",
          },
          { status: 403 },
        );
      }

      const authProvider = Array.isArray(delegation.providers)
        ? delegation.providers[0]
        : (delegation.providers as {
            user_id?: string | null;
            is_active?: boolean | null;
            prefix?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            npi_number?: string | null;
          } | null);

      if (!authProvider?.user_id) {
        return NextResponse.json(
          {
            success: false,
            error: "Authorizing provider record is invalid. Contact AimRx support.",
          },
          { status: 409 },
        );
      }

      if (authProvider.is_active !== true) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your authorizing provider's account is inactive. Submissions are paused until the provider is reactivated.",
          },
          { status: 403 },
        );
      }

      submittedByDelegationId = delegation.id;
      authorisingProviderUserId = authProvider.user_id;

      // Capture the assistant's own name for the audit log (it'll be lost
      // once we override body.prescriber with the authorizing provider's
      // identity below).
      const { data: assistantRow } = await supabaseLookup
        .from("providers")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      assistantNameForAudit = `${assistantRow?.first_name ?? ""} ${assistantRow?.last_name ?? ""}`.trim() || (user.email ?? "assistant");

      // Override the outgoing prescriber block with the authorizing provider's
      // identity. The pharmacy / PDF MUST reflect the legal prescriber, not
      // the assistant.
      body.prescriber = {
        prefix: authProvider.prefix ?? body.prescriber.prefix ?? null,
        first_name: authProvider.first_name ?? body.prescriber.first_name,
        last_name: authProvider.last_name ?? body.prescriber.last_name,
        npi: authProvider.npi_number ?? body.prescriber.npi,
        dea: body.prescriber.dea,
      };
    }

    // Validate required fields
    if (
      !body.prescriber_id ||
      !body.patient_id ||
      !body.medication ||
      !body.dosage
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    // Verify patient exists
    const { data: patientRecord } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("id", body.patient_id)
      .single();

    if (!patientRecord) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }

    // Get provider profile (using prescriber_id so admin-assisted flows work)
    // For delegate submissions we ALSO load the AUTHORIZING provider's row,
    // since legal-prescriber credentials (NPI/DEA/sig/license) live there,
    // not on the assistant's row.
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select(
        "id, is_active, payment_details, physical_address, billing_address, prefix, first_name, last_name, npi_number, dea_number, phone_number, signature_url, pay_on_terms, medical_licenses",
      )
      .eq("user_id", body.prescriber_id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { success: false, error: "Provider profile not found for prescriber" },
        { status: 404 },
      );
    }

    // Task #65: server-side override of body.prescriber for ALL roles
    // (delegate handled above lines 240-249, this covers direct
    // providers + admin-assisted submissions). The shared
    // resolveAuthorizingProvider helper is the single source of truth
    // for "whose NPI / DEA / signature goes on the outgoing Rx?". For
    // delegates we already know `authorisingProviderUserId`; for
    // direct providers/admins it's the body.prescriber_id (the same
    // user_id we just loaded `provider` for above).
    {
      const { resolveAuthorizingProvider } = await import(
        "@core/services/authorizing-provider"
      );
      const resolved = await resolveAuthorizingProvider(supabaseAdmin, {
        prescriberId: body.prescriber_id,
        delegationId: submittedByDelegationId,
      });
      if (!resolved) {
        await supabaseAdmin.from("system_logs").insert({
          user_id: user.id,
          user_email: user.email ?? null,
          user_name: user.email ?? userRole ?? "",
          action: "PRESCRIPTION_SUBMIT_AUTH_PROVIDER_UNRESOLVED",
          details:
            `prescriberUserId=${body.prescriber_id} ` +
            `delegationId=${submittedByDelegationId ?? "none"} ` +
            `role=${userRole}`,
          status: "error",
        });
        return NextResponse.json(
          {
            success: false,
            error:
              "Could not resolve the authorizing provider for this submission. Contact AimRx support.",
          },
          { status: 409 },
        );
      }
      // Overwrite the outgoing prescriber block. For direct providers
      // this is essentially a no-op (same user_id loaded twice) but it
      // closes the door on any future code path that submits with a
      // stale or hand-crafted body.prescriber.
      body.prescriber = {
        prefix: resolved.provider.prefix ?? body.prescriber.prefix ?? null,
        first_name:
          resolved.provider.first_name ?? body.prescriber.first_name,
        last_name: resolved.provider.last_name ?? body.prescriber.last_name,
        npi: resolved.provider.npi_number ?? undefined,
        dea: resolved.provider.dea_number ?? undefined,
      };
      await supabaseAdmin.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: user.email ?? userRole ?? "",
        action: "PRESCRIPTION_SUBMIT_PRESCRIBER_RESOLVED",
        details:
          `prescriberUserId=${body.prescriber_id} ` +
          `authProviderUserId=${resolved.provider.user_id} ` +
          `viaDelegation=${resolved.viaDelegation} ` +
          `delegationId=${resolved.delegationId ?? "none"} ` +
          `role=${userRole} ` +
          `hasNpi=${!!resolved.provider.npi_number} ` +
          `hasDea=${!!resolved.provider.dea_number} ` +
          `hasSig=${!!resolved.provider.signature_url}`,
        status: "info",
      });
    }

    // For providers and delegates, verify access to this patient.
    //
    // For DELEGATES (provider assistants): the access check runs against the
    // AUTHORIZING provider's panel, not the delegate's own row. A delegate's
    // entire job is to act on behalf of the supervising provider, so anyone
    // on the supervising provider's panel is by definition fair game. Using
    // the delegate's own provider_patient_mappings here was the May 13 2026
    // Cather/Whipps/Dale Patterson bug — Cather is delegated to Whipps but
    // not auto-mapped to every Whipps patient (the clinic-share trigger
    // requires both providers in the same non-null group, which Whipps was
    // not), so every delegate submission for a Whipps-owned patient silently
    // 403'd.
    //
    // For DIRECT PROVIDERS the check stays as before: their own provider id
    // against their own panel.
    //
    // Admins are intentionally trusted for admin-assisted submissions.
    if (userRole === "provider" || userRole === "delegate") {
      let mappingProviderId = provider.id;
      if (userRole === "delegate") {
        // Fail-closed: if we cannot resolve the authorizing provider's
        // provider.id we MUST NOT silently fall back to the assistant's
        // own row — that would re-introduce exactly the inverse of the
        // Cather/Whipps bug (a delegate seeing only her own panel
        // instead of the supervising provider's).
        if (!authorisingProviderUserId) {
          await supabaseAdmin.from("system_logs").insert({
            user_id: user.id,
            user_email: user.email ?? null,
            user_name: user.email ?? "delegate",
            action: "PRESCRIPTION_SUBMIT_AUTH_PROVIDER_USER_ID_MISSING",
            details: `delegationId=${submittedByDelegationId ?? "none"}`,
            status: "error",
          });
          return NextResponse.json(
            {
              success: false,
              error:
                "Could not resolve your authorizing provider for access check. Contact AimRx support.",
            },
            { status: 409 },
          );
        }
        const { data: authProviderRow, error: authProviderErr } =
          await supabaseAdmin
            .from("providers")
            .select("id")
            .eq("user_id", authorisingProviderUserId)
            .maybeSingle();
        if (authProviderErr || !authProviderRow?.id) {
          await supabaseAdmin.from("system_logs").insert({
            user_id: user.id,
            user_email: user.email ?? null,
            user_name: user.email ?? "delegate",
            action: "PRESCRIPTION_SUBMIT_AUTH_PROVIDER_ROW_LOOKUP_FAILED",
            details:
              `authProviderUserId=${authorisingProviderUserId} ` +
              `delegationId=${submittedByDelegationId ?? "none"} ` +
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
        mappingProviderId = authProviderRow.id;
      }

      const { data: mapping } = await supabaseAdmin
        .from("provider_patient_mappings")
        .select("id")
        .eq("provider_id", mappingProviderId)
        .eq("patient_id", patientRecord.id)
        .maybeSingle();

      if (!mapping) {
        // Log the denial so future cases aren't invisible (the 403 path
        // historically wrote nothing to system_logs, which is exactly why
        // the Cather/Whipps incident took so long to diagnose).
        await supabaseAdmin.from("system_logs").insert({
          user_id: user.id,
          user_email: user.email ?? null,
          user_name: user.email ?? userRole ?? "",
          action: "PRESCRIPTION_SUBMIT_PATIENT_ACCESS_DENIED",
          details:
            `role=${userRole} ` +
            `prescriberUserId=${body.prescriber_id} ` +
            `authProviderUserId=${authorisingProviderUserId ?? "self"} ` +
            `mappingProviderId=${mappingProviderId} ` +
            `patientId=${patientRecord.id}`,
          status: "error",
        });
        return NextResponse.json(
          { success: false, error: "You do not have access to this patient" },
          { status: 403 },
        );
      }
    }

    // ── Manning-incident unified pre-payment validator (Task #64) ────
    // Block prescription creation BEFORE payment when the legal
    // prescriber's row is missing identity fields the outgoing Rx PDF
    // and DigitalRx Doctor block both require. Joseph's "nothing stops
    // the order" rule applies POST-payment only — pre-payment we MUST
    // refuse rather than queue a payment that can never legally ship.
    //
    // Applies to all roles:
    //   - delegate: validate the AUTHORIZING provider's row.
    //   - provider: validate self.
    //   - admin: validate the body-supplied prescriber.
    {
      const validateUserId = authorisingProviderUserId ?? body.prescriber_id;
      // For delegates, `provider` above is the assistant's row (still
      // needed for patient-mapping check). Re-load the authorizing
      // provider's credential fields here so the validator sees the
      // legal-prescriber data.
      let credSource: {
        npi_number?: string | null;
        dea_number?: string | null;
        signature_url?: string | null;
        medical_licenses?: unknown;
      } | null;
      if (validateUserId === body.prescriber_id) {
        credSource = provider;
      } else {
        const { data: authRow } = await supabaseAdmin
          .from("providers")
          .select("npi_number, dea_number, signature_url, medical_licenses")
          .eq("user_id", validateUserId)
          .maybeSingle();
        credSource = authRow;
      }

      const { computeMissingPrescriberFields } = await import(
        "@core/services/prescriber-credentials"
      );
      const missing = computeMissingPrescriberFields(credSource);

      if (missing.length > 0) {
        const isDelegate = userRole === "delegate";
        await supabaseAdmin.from("system_logs").insert({
          user_id: user.id,
          user_email: user.email ?? null,
          user_name: user.email ?? userRole,
          action: "PRESCRIPTION_SUBMIT_BLOCKED_PROFILE_INCOMPLETE",
          status: "error",
          details:
            `Pre-payment block: prescriberUserId=${validateUserId} role=${userRole} ` +
            `missing=[${missing.join(",")}]` +
            (isDelegate
              ? ` delegationId=${submittedByDelegationId} delegateUserId=${user.id}`
              : ""),
        });
        return NextResponse.json(
          {
            success: false,
            error: isDelegate
              ? `Cannot submit: your authorizing provider's profile is missing ${missing.join(", ")}. Ask them to complete their profile and try again.`
              : `Cannot submit: your profile is missing ${missing.join(", ")}. Complete your profile and try again.`,
            missing,
          },
          { status: 422 },
        );
      }
    }

    // Require pharmacy_id
    if (!body.pharmacy_id) {
      await supabaseAdmin.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: user.email ?? userRole,
        action: "PRESCRIPTION_SUBMIT_BLOCKED_NO_PHARMACY",
        details:
          `role=${userRole} ` +
          `prescriberUserId=${body.prescriber_id} ` +
          `patientId=${body.patient_id ?? "—"} ` +
          `medication=${body.medication ?? "—"}`,
        status: "error",
      });
      return NextResponse.json(
        { success: false, error: "pharmacy_id is required" },
        { status: 400 },
      );
    }

    const { data: backendCheck, error: backendErr } = await supabaseAdmin
      .from("pharmacy_backends")
      .select("id")
      .eq("pharmacy_id", body.pharmacy_id)
      .eq("is_active", true)
      .eq("system_type", "DigitalRx")
      .single();

    if (!backendCheck) {
      await supabaseAdmin.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: user.email ?? userRole,
        action: "PRESCRIPTION_SUBMIT_BLOCKED_PHARMACY_BACKEND_MISSING",
        details:
          `role=${userRole} ` +
          `prescriberUserId=${body.prescriber_id} ` +
          `patientId=${body.patient_id ?? "—"} ` +
          `pharmacyId=${body.pharmacy_id} ` +
          `medication=${body.medication ?? "—"} ` +
          `lookupError=${backendErr?.message ?? "no_active_digitalrx_row"}`,
        status: "error",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Selected pharmacy does not have DigitalRx configured.",
        },
        { status: 400 },
      );
    }

    // Save prescription to Supabase — always pending_payment, pharmacy submission happens after payment

    // SECURITY: Provider cannot set their own price/shipping. Always pull from catalog/profile.
    // Enforce medication price from catalog (pharmacy_medications.aimrx_site_pricing_cents),
    // then apply the prescriber's tier discount so the saved patient_price matches what
    // the cart UI displayed (cart applies tier discount in /api/provider/pharmacy).
    // INCIDENT Apr 24, 2026: prior to this fix the cart showed a discounted price but the
    // server stored the raw catalog price, causing the patient to be over-charged by the
    // discount amount.
    // Tier discount lookup must be against the AUTHORISING provider's
    // user_id, not the delegate-assistant's. For direct submissions both
    // are the same; for delegate submissions they differ and the assistant's
    // own providers row almost never has tier_level set (causing 0% discount
    // and the patient being overcharged). INCIDENT Apr 24, 2026.
    const tierLookupUserId =
      userRole === "delegate" && authorisingProviderUserId
        ? authorisingProviderUserId
        : body.prescriber_id;
    let enforcedPatientPrice: string | null = body.patient_price || null;
    if (body.medication_id && tierLookupUserId) {
      const { data: medRow } = await supabaseAdmin
        .from("pharmacy_medications")
        .select("aimrx_site_pricing_cents, retail_price_cents, notes")
        .eq("id", body.medication_id)
        .maybeSingle();
      // Mirror the catalog-price fallback chain that /api/provider/pharmacy
      // uses, so a Supabase schema-cache miss on aimrx_site_pricing_cents
      // doesn't silently skip the discount block.
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
          // Use the EFFECTIVE tier helper: the caller's own tier wins
          // (so a per-assistant tier override set by admin / supervising
          // provider takes effect), falling back to the supervising
          // provider's tier when the assistant has no override of their
          // own. Pass the AUTH caller's user.id (not tierLookupUserId)
          // because the helper does the assistant→supervisor fallback
          // internally.
          const tier = await getEffectiveTierDiscountForUser(
            supabaseAdmin,
            user.id,
          );
          if (
            Number.isFinite(tier.discountPercentage) &&
            tier.discountPercentage >= 0 &&
            tier.discountPercentage <= 100
          ) {
            discountPct = tier.discountPercentage;
          }
        } catch (err) {
          console.error(
            "[submit][TIER_LOOKUP_THROW] tier discount lookup threw — falling back to 0%.",
            "callerUserId=", user.id,
            "tierLookupUserId=", tierLookupUserId,
            "err=", err instanceof Error ? err.message : err,
          );
          discountPct = 0;
        }
        // Fail loud (server console only — visible in Render logs) when a
        // provider whose tier_level IS set somehow ends up with 0% discount.
        // That signals a tier_code drift, schema-cache miss, or RLS issue —
        // a human needs to look. We do NOT block the submit on it because
        // that would strand providers; the patient just temporarily pays full
        // price (recoverable) instead of the submission failing.
        if (discountPct === 0) {
          const { data: provCheck } = await supabaseAdmin
            .from("providers")
            .select("tier_level")
            .eq("user_id", tierLookupUserId)
            .maybeSingle();
          if (provCheck?.tier_level) {
            console.error(
              "[submit][TIER_LOOKUP_MISMATCH] provider has tier_level but resolved discount=0%.",
              "tierLookupUserId=", tierLookupUserId,
              "tier_level=", JSON.stringify(provCheck.tier_level),
              "userRole=", userRole,
              "medication_id=", body.medication_id,
              "submittedByDelegationId=", submittedByDelegationId,
            );
          }
        }
        const discountedUnitCents =
          discountPct > 0
            ? Math.round(catalogCents * (1 - discountPct / 100))
            : catalogCents;
        const unitDollars = discountedUnitCents / 100;
        const totalDollars = unitDollars * (body.quantity || 1);
        enforcedPatientPrice = totalDollars.toFixed(2);
      }
    }

    // Enforce shipping fee from the selected PHARMACY profile (admin-controlled).
    // Providers cannot influence shipping at all. The AMOUNT is always the
    // pharmacy's configured fee (fallback $25). For multi-item carts, exactly
    // ONE prescription per order_group_id carries the fee — the rest are $0.
    //
    // PRIOR BUG: this used to only enforce when `body.shipping_fee_cents > 0`,
    // so when a front-end glitch sent 0 the server happily saved 0. We now
    // self-heal: if no other prescription in this order group already has a
    // shipping fee stamped, this one becomes the carrier. Submission is
    // sequential (await per item), so the check is reliable.
    let enforcedShippingFeeCents = 0;
    const isShippingDelivery =
      !body.delivery_method || body.delivery_method === "shipping";
    if (isShippingDelivery && body.pharmacy_id) {
      let groupAlreadyHasShipping = false;
      if (body.submission_group_id) {
        const { data: existingShipping } = await supabaseAdmin
          .from("prescriptions")
          .select("id")
          .eq("order_group_id", body.submission_group_id)
          .gt("shipping_fee_cents", 0)
          .limit(1);
        groupAlreadyHasShipping = (existingShipping?.length ?? 0) > 0;
      }
      if (!groupAlreadyHasShipping) {
        const { data: pharmacyRow } = await supabaseAdmin
          .from("pharmacies")
          .select("shipping_fee_cents")
          .eq("id", body.pharmacy_id)
          .maybeSingle();
        const pharmacyShippingCents =
          pharmacyRow?.shipping_fee_cents != null
            ? Number(pharmacyRow.shipping_fee_cents)
            : 2500; // safe fallback: $25
        enforcedShippingFeeCents = Number.isFinite(pharmacyShippingCents)
          ? pharmacyShippingCents
          : 2500;
      }
    }

    // Convert patient_price from dollars to cents for total_paid_cents
    const medicationPriceCents = enforcedPatientPrice
      ? Math.round(parseFloat(enforcedPatientPrice) * 100)
      : 0;
    const totalPaidCents =
      medicationPriceCents + (body.profit_cents || 0) + enforcedShippingFeeCents;

    const { data: prescription, error: prescriptionError } = await supabaseAdmin
      .from("prescriptions")
      .insert({
        prescriber_id: body.prescriber_id,
        prescription_type: body.prescription_type ?? "prescription",
        parent_prescription_id: body.parent_prescription_id ?? null,
        submitted_by_delegation_id: submittedByDelegationId,
        patient_id: body.patient_id,
        encounter_id: body.encounter_id || null,
        appointment_id: body.appointment_id || null,
        medication: body.medication,
        dosage: body.dosage,
        dosage_amount: body.dosage_amount || null,
        dosage_unit: body.dosage_unit || null,
        vial_size: body.vial_size || null,
        form: body.form || null,
        quantity: body.quantity,
        refills: body.refills,
        sig: body.sig,
        dispense_as_written: body.dispense_as_written || false,
        pharmacy_notes: body.pharmacy_notes || null,
        patient_price: enforcedPatientPrice, // SECURITY: server-enforced from catalog
        pharmacy_id: body.pharmacy_id || null,
        medication_id: body.medication_id || null,
        profit_cents: body.profit_cents || 0, // Provider oversight/monitoring fees
        consultation_reason: body.consultation_reason || null, // Reason for the consultation fee
        shipping_fee_cents: enforcedShippingFeeCents, // SECURITY: server-enforced global ($25 admin-set)
        order_group_id: body.submission_group_id || null,
        total_paid_cents: totalPaidCents, // Medication price in cents
        refill_frequency_days: (body.refills && body.refills > 0 && body.refill_frequency_days && body.refill_frequency_days > 0)
          ? body.refill_frequency_days
          : null,
        next_refill_date: null,
        has_custom_address: body.has_custom_address || false,
        custom_address: body.custom_address || null,
        queue_id: null,
        status: "pending_payment",
        payment_status: "pending",
      })
      .select()
      .single();

    if (prescriptionError) {
      console.error("❌ Error saving to database:", prescriptionError);
      await supabaseAdmin.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: user.email ?? userRole,
        action: "PRESCRIPTION_SUBMIT_INSERT_FAILED",
        details:
          `role=${userRole} ` +
          `prescriberUserId=${body.prescriber_id} ` +
          `patientId=${body.patient_id ?? "—"} ` +
          `pharmacyId=${body.pharmacy_id ?? "—"} ` +
          `medication=${body.medication ?? "—"} ` +
          `dbError=${prescriptionError.message ?? "unknown"} ` +
          `dbCode=${(prescriptionError as { code?: string }).code ?? "—"}`,
        status: "error",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save prescription",
          error_details: prescriptionError,
        },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name:
        userRole === "delegate" && assistantNameForAudit
          ? `${assistantNameForAudit} (assistant for ${body.prescriber.prefix || "Dr."} ${body.prescriber.first_name} ${body.prescriber.last_name})`
          : `${body.prescriber.prefix || "Dr."} ${body.prescriber.first_name} ${body.prescriber.last_name}`,
      action: "PRESCRIPTION_SUBMITTED",
      details:
        userRole === "delegate"
          ? `${body.medication} ${body.dosage} for ${body.patient.first_name} ${body.patient.last_name} — submitted by ${assistantNameForAudit ?? "assistant"} on behalf of ${body.prescriber.prefix || "Dr."} ${body.prescriber.first_name} ${body.prescriber.last_name} (NPI ${body.prescriber.npi ?? "—"}) — awaiting payment`
          : `${body.medication} ${body.dosage} for ${body.patient.first_name} ${body.patient.last_name} — awaiting payment`,
      status: "success",
    });

    // ──────────────────────────────────────────────────────────────────────
    // PAY-ON-TERMS AUTO-SUBMIT
    // If the prescriber is on pay-on-terms, the patient is never charged at
    // ordering time. Immediately mark the prescription paid (which also
    // submits it to the pharmacy) so the order doesn't sit in pending_payment
    // waiting for a frontend step that may never run.
    // ──────────────────────────────────────────────────────────────────────
    let isPayOnTerms =
      (provider as { pay_on_terms?: boolean | null }).pay_on_terms === true;

    // ── Task #67: delegate-only pay-on-terms re-check (Manning incident) ─
    // For delegate (Provider Assistant) submissions the `provider` row
    // above was loaded via body.prescriber_id = the assistant's user.id,
    // and the assistant's row always has pay_on_terms=false per the
    // Provider Assistance spec. Without this re-check, every delegate-
    // submitted Rx where the supervising provider is on pay-on-terms
    // falls through to the 15-minute payment-janitor cohort instead of
    // auto-firing in <1s like a direct-provider submission. (William
    // Manning, queue 2239402, 193-minute gap, 2026-05-09.)
    //
    // HARD RULES (from plan + architect review):
    //  - Direct/admin paths: authorisingProviderUserId is null → block
    //    is skipped entirely. Zero behavior change.
    //  - Lookup failure: do NOT assume pay_on_terms=true. Leave the flag
    //    as the assistant's `false` and let the order fall through to
    //    the slow path, just like today (no regression). The Manning
    //    bug pattern was silent fallback — we never want to repeat it.
    //  - Do NOT mutate `provider`; downstream consumers (submit-to-
    //    pharmacy-core, mark-paid) read the prescription row, not this
    //    in-memory object, so flipping `isPayOnTerms` in-process is safe.
    if (
      !isPayOnTerms &&
      authorisingProviderUserId &&
      authorisingProviderUserId !== body.prescriber_id
    ) {
      try {
        const { data: authPotRow, error: authPotErr } = await supabaseAdmin
          .from("providers")
          .select("pay_on_terms")
          .eq("user_id", authorisingProviderUserId)
          .maybeSingle();
        if (authPotErr) {
          await supabaseAdmin.from("system_logs").insert({
            user_id: user.id,
            user_email: user.email ?? null,
            user_name: assistantNameForAudit ?? user.email ?? "delegate",
            action: "PRESCRIPTION_AUTOFIRE_DELEGATE_POT_LOOKUP_FAILED",
            status: "warning",
            details:
              `rx=${prescription.id} ` +
              `authProviderUserId=${authorisingProviderUserId} ` +
              `delegationId=${submittedByDelegationId ?? "none"} ` +
              `error=${authPotErr.message ?? String(authPotErr)} — ` +
              `falling through to slow payment-janitor path.`,
          });
        } else if (authPotRow?.pay_on_terms === true) {
          isPayOnTerms = true;
          await supabaseAdmin.from("system_logs").insert({
            user_id: user.id,
            user_email: user.email ?? null,
            user_name: assistantNameForAudit ?? user.email ?? "delegate",
            action: "PRESCRIPTION_AUTOFIRE_DELEGATE_RESOLVED_POT",
            status: "info",
            details:
              `rx=${prescription.id} ` +
              `authProviderUserId=${authorisingProviderUserId} ` +
              `delegationId=${submittedByDelegationId ?? "none"} ` +
              `assistant=${assistantNameForAudit ?? "unknown"} — ` +
              `auto-fire enabled via authorizing provider's pay_on_terms flag.`,
          });
        } else {
          await supabaseAdmin.from("system_logs").insert({
            user_id: user.id,
            user_email: user.email ?? null,
            user_name: assistantNameForAudit ?? user.email ?? "delegate",
            action: "PRESCRIPTION_AUTOFIRE_DELEGATE_SKIPPED_NOT_POT",
            status: "info",
            details:
              `rx=${prescription.id} ` +
              `authProviderUserId=${authorisingProviderUserId} ` +
              `delegationId=${submittedByDelegationId ?? "none"} — ` +
              `authorizing provider is not pay-on-terms; awaiting patient payment.`,
          });
        }
      } catch (err) {
        try {
          await supabaseAdmin.from("system_logs").insert({
            user_id: user.id,
            user_email: user.email ?? null,
            user_name: assistantNameForAudit ?? user.email ?? "delegate",
            action: "PRESCRIPTION_AUTOFIRE_DELEGATE_POT_LOOKUP_FAILED",
            status: "warning",
            details:
              `rx=${prescription.id} ` +
              `authProviderUserId=${authorisingProviderUserId} ` +
              `delegationId=${submittedByDelegationId ?? "none"} ` +
              `threw=${err instanceof Error ? err.message : String(err)} — ` +
              `falling through to slow payment-janitor path.`,
          });
        } catch {
          // Logging itself failed; nothing else to do — order still
          // proceeds via slow path, no exception escapes.
        }
      }
    }

    if (isPayOnTerms) {
      try {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const internalApiKey = process.env.INTERNAL_API_KEY || "";
        const markRes = await fetch(
          `${siteUrl}/api/prescriptions/${prescription.id}/mark-paid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-api-key": internalApiKey,
            },
            body: JSON.stringify({ suppressPatientEmail: true }),
          },
        );
        const markJson = await markRes.json().catch(() => ({}));
        if (!markRes.ok || !markJson?.success) {
          console.error(
            `[submit] pay-on-terms auto-mark-paid failed for rx ${prescription.id}:`,
            markJson,
          );
          // Fall through — prescription still exists, will need manual mark-paid
        } else {
          // mark-paid returns success:true even when the inner submit-to-pharmacy
          // call failed (it surfaces the failure via `pharmacyError` /
          // `warning` / `pharmacyWarning` fields). If we don't inspect those,
          // the Rx silently sits in payment_received with no queue_id and the
          // patient never reaches the pharmacy. (See Andrea Boehm 04/30/2026.)
          const pharmacyFailureMessage: string | undefined =
            markJson?.pharmacyError ||
            markJson?.warning ||
            markJson?.pharmacyWarning;
          if (pharmacyFailureMessage) {
            console.error(
              `[submit] pay-on-terms mark-paid OK but pharmacy submit FAILED for rx ${prescription.id}: ${pharmacyFailureMessage}`,
            );
            // Loud, persistent alert so admins notice this stuck Rx instead of
            // it disappearing into the "payment_received" bucket.
            try {
              const { createAdminClient: createAdminClientForLog } =
                await import("@core/database/client");
              await createAdminClientForLog()
                .from("system_logs")
                .insert({
                  user_id: null,
                  user_email: "internal@aimrx",
                  user_name: "System (Pay-on-Terms)",
                  action: "POT_AUTOSUBMIT_PHARMACY_FAILED",
                  details: `Pay-on-Terms rx ${prescription.id} was marked paid but pharmacy submission failed. Manual rescue required (admin → prescription detail → "Submit to Pharmacy"). Underlying error: ${pharmacyFailureMessage}`,
                  status: "error",
                });
            } catch (logErr) {
              console.error(
                `[submit] failed to write POT_AUTOSUBMIT_PHARMACY_FAILED log:`,
                logErr,
              );
            }
            return NextResponse.json(
              {
                success: true,
                message:
                  "Prescription created and marked paid (pay-on-terms), but pharmacy submission failed — manual resubmit required.",
                prescription_id: prescription.id,
                requires_payment: false,
                paid_on_terms: true,
                status: "payment_received_pharmacy_pending",
                pharmacy_submission_failed: true,
                pharmacy_error: pharmacyFailureMessage,
              },
              { status: 201 },
            );
          }
          console.log(
            `[submit] pay-on-terms auto-submitted rx ${prescription.id} to pharmacy`,
          );
          return NextResponse.json(
            {
              success: true,
              message:
                "Prescription created and auto-submitted to pharmacy (pay-on-terms)",
              prescription_id: prescription.id,
              requires_payment: false,
              paid_on_terms: true,
              status: "submitted",
            },
            { status: 201 },
          );
        }
      } catch (err) {
        console.error(
          `[submit] pay-on-terms auto-mark-paid threw for rx ${prescription.id}:`,
          err,
        );
        // Fall through to default response
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Prescription created - awaiting payment",
        prescription_id: prescription.id,
        requires_payment: true,
        status: "pending_payment",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error details:", errorMessage);

    // Return detailed error for debugging (only in development)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          error_details: error instanceof Error ? error.stack : String(error),
        }),
      },
      { status: 500 },
    );
  }
}
