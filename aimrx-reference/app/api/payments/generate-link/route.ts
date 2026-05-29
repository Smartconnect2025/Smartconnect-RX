import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";
import crypto from "crypto";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function POST(request: NextRequest) {
  const claimedRxIds: string[] = [];
  const supabaseOuter = createAdminClient();

  try {
    const internalKey = request.headers.get("x-internal-api-key");
    const isInternalCall = !!(INTERNAL_API_KEY && internalKey && internalKey === INTERNAL_API_KEY);

    let userId: string | null = null;
    let isAdmin = false;

    if (isInternalCall) {
      isAdmin = true;
    } else {
      const { user, userRole } = await getUser();

      if (!user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      if (userRole !== "provider" && userRole !== "delegate" && userRole !== "admin" && userRole !== "super_admin") {
        return NextResponse.json(
          { error: "Provider or admin access required" },
          { status: 403 },
        );
      }

      userId = user.id;
      isAdmin = userRole === "admin" || userRole === "super_admin";
    }

    const body = await request.json();
    const {
      prescriptionId,
      prescriptionIds: rawPrescriptionIds,
      consultationFeeCents,
      medicationCostCents,
      shippingFeeCents,
      description,
      patientEmail,
      sendEmail,
      sendReceiptToPatient,
    } = body;

    const prescriptionIds: string[] = Array.isArray(rawPrescriptionIds) && rawPrescriptionIds.length > 0
      ? rawPrescriptionIds
      : prescriptionId
        ? [prescriptionId]
        : [];

    if (prescriptionIds.length === 0) {
      return NextResponse.json(
        { error: "Missing prescriptionId(s)" },
        { status: 400 },
      );
    }

    const parsedShipping = shippingFeeCents != null ? Number(shippingFeeCents) : 0;

    const primaryPrescriptionId = prescriptionIds[0];

    const supabase = createAdminClient();

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select(
        `
        id,
        patient_id,
        prescriber_id,
        pharmacy_id,
        medication,
        quantity,
        payment_status,
        patient:patients(id, first_name, last_name, email, phone),
        pharmacy:pharmacies(id, name)
      `,
      )
      .eq("id", primaryPrescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 },
      );
    }

    // CHECK 1: If prescription is already paid, reject
    if (prescription.payment_status === "paid") {
      return NextResponse.json(
        { error: "This prescription has already been paid" },
        { status: 400 },
      );
    }

    if (!isInternalCall && !isAdmin && prescription.prescriber_id !== userId) {
      return NextResponse.json(
        { error: "You do not have permission to bill for this prescription" },
        { status: 403 },
      );
    }

    if (prescriptionIds.length > 1) {
      const { data: allRxs, error: allRxsError } = await supabase
        .from("prescriptions")
        .select("id, patient_id, prescriber_id, payment_status")
        .in("id", prescriptionIds);

      if (allRxsError || !allRxs || allRxs.length !== prescriptionIds.length) {
        return NextResponse.json(
          { error: "One or more prescription IDs are invalid" },
          { status: 400 },
        );
      }

      const allSamePatient = allRxs.every((rx) => rx.patient_id === prescription.patient_id);
      const allSamePrescriber = allRxs.every((rx) => rx.prescriber_id === prescription.prescriber_id);
      const anyAlreadyPaid = allRxs.some((rx) => rx.payment_status === "paid");

      if (!allSamePatient) {
        return NextResponse.json(
          { error: "All prescriptions must belong to the same patient" },
          { status: 400 },
        );
      }

      if (!allSamePrescriber) {
        return NextResponse.json(
          { error: "All prescriptions must belong to the same provider" },
          { status: 400 },
        );
      }

      if (anyAlreadyPaid) {
        return NextResponse.json(
          { error: "One or more prescriptions have already been paid" },
          { status: 400 },
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // FULL-GROUP INTEGRITY GUARD (Greenwich/Rahmany incident, May 2026)
    // ────────────────────────────────────────────────────────────────────
    // If any requested prescription is part of an order_group_id, the request
    // MUST cover the FULL set of unpaid eligible siblings in that group.
    // Partial-group bills (1-of-6, 3-of-6, etc.) are rejected with 422 so
    // callers cannot under-bill the patient. The webhook + verify-and-complete
    // routes have been hardened to NOT fan out by order_group_id, so any
    // gap left by a partial bill would silently strand un-paid siblings.
    {
      const { data: requestedRxsForGuard } = await supabase
        .from("prescriptions")
        .select("id, order_group_id, payment_status, status, patient_price, shipping_fee_cents, profit_cents, medication")
        .in("id", prescriptionIds);

      if (!requestedRxsForGuard || requestedRxsForGuard.length !== prescriptionIds.length) {
        return NextResponse.json(
          { error: "One or more prescription IDs are invalid" },
          { status: 400 },
        );
      }

      const groupIdsInvolved = [
        ...new Set(
          requestedRxsForGuard
            .map((r) => r.order_group_id)
            .filter((g): g is string => !!g),
        ),
      ];

      if (groupIdsInvolved.length > 0) {
        const { data: eligibleSiblings } = await supabase
          .from("prescriptions")
          .select("id, order_group_id, patient_price, shipping_fee_cents, profit_cents, medication, payment_status, status")
          .in("order_group_id", groupIdsInvolved)
          .neq("payment_status", "paid");

        const eligible = (eligibleSiblings || []).filter((r) => {
          const s = (r.status || "").toLowerCase();
          return s !== "cancelled" && s !== "rejected" && s !== "void";
        });

        const eligibleIdSet = new Set(eligible.map((r) => r.id));
        const requestedSet = new Set(prescriptionIds);

        const missingIds = [...eligibleIdSet].filter((id) => !requestedSet.has(id));

        if (missingIds.length > 0) {
          let requiredTotalCents = 0;
          for (const r of eligible) {
            const pp = r.patient_price ? parseFloat(r.patient_price) : 0;
            requiredTotalCents += Number.isFinite(pp) ? Math.round(pp * 100) : 0;
            requiredTotalCents += r.shipping_fee_cents || 0;
            requiredTotalCents += r.profit_cents || 0;
          }

          console.warn(
            `[generate-link][GROUP-GUARD] Rejecting partial bill: requested ${prescriptionIds.length} of ${eligible.length} eligible siblings in group(s) ${groupIdsInvolved.join(",")}; missing=${missingIds.join(",")}`,
          );

          return NextResponse.json(
            {
              error: "GROUPED_BILL_REQUIRES_ALL_IDS",
              message: `This prescription is part of a group with ${eligible.length} unpaid items. You must bill all of them together; partial-group billing is not allowed.`,
              group_ids: groupIdsInvolved,
              required_prescription_ids: [...eligibleIdSet],
              missing_prescription_ids: missingIds,
              required_total_cents: requiredTotalCents,
            },
            { status: 422 },
          );
        }
      }
    }

    // Pay-on-terms bypass — runs ONLY after the full batch has been validated to
    // belong to the same patient + same prescribing provider. This prevents a
    // caller from smuggling foreign rx IDs into a batch tied to a terms-enabled
    // provider and forcing them paid.
    if (prescription.prescriber_id) {
      const { data: providerRow } = await supabase
        .from("providers")
        .select("pay_on_terms, prefix, first_name, last_name")
        .eq("user_id", prescription.prescriber_id)
        .maybeSingle();

      if (providerRow?.pay_on_terms === true) {
        // Cancel/expire any existing pending or processing payment_transactions
        // for these prescriptions so a previously-issued payment link cannot be
        // used to double-collect after we mark them paid on terms.
        const { data: existingForCleanup } = await supabase
          .from("payment_transactions")
          .select("id")
          .in("prescription_id", prescriptionIds)
          .in("payment_status", ["pending", "processing"]);

        if (existingForCleanup && existingForCleanup.length > 0) {
          const txIds = existingForCleanup.map((r) => r.id);
          await supabase
            .from("payment_transactions")
            .update({
              payment_status: "expired",
              payment_link_expires_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in("id", txIds);
          console.log(`[generate-link][pay-on-terms] expired ${txIds.length} pre-existing payment_transactions`);
        }

        const siteUrl = envConfig.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const internalApiKey = process.env.INTERNAL_API_KEY || "";
        const results: Array<{ id: string; ok: boolean; error?: string }> = [];

        for (const rxId of prescriptionIds) {
          try {
            const r = await fetch(`${siteUrl}/api/prescriptions/${rxId}/mark-paid`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-api-key": internalApiKey,
              },
              // Pay-on-terms = the patient never paid, so do NOT email them a receipt.
              body: JSON.stringify({ suppressPatientEmail: true }),
            });
            const j = await r.json().catch(() => ({}));
            results.push({ id: rxId, ok: r.ok && j.success, error: j.error });
          } catch (err) {
            results.push({
              id: rxId,
              ok: false,
              error: err instanceof Error ? err.message : "fetch failed",
            });
          }
        }

        const failed = results.filter((r) => !r.ok);
        if (failed.length === results.length) {
          return NextResponse.json(
            {
              error: "Pay-on-terms enabled but auto-mark-paid failed",
              details: failed,
            },
            { status: 500 },
          );
        }

        const providerName = `${(providerRow as { prefix?: string | null }).prefix || "Dr."} ${providerRow.first_name || ""} ${providerRow.last_name || ""}`.trim();
        return NextResponse.json({
          success: true,
          paidOnTerms: true,
          providerName,
          markedCount: results.length - failed.length,
          failedCount: failed.length,
          message: `Auto-paid on terms for ${providerName || "this provider"} — submitted to pharmacy.`,
          ...(failed.length > 0 ? { partialFailures: failed } : {}),
        });
      }
    }

    // Money fields are required for the normal payment-link flow but NOT for
    // the pay-on-terms bypass above. Validate here, after the bypass branch.
    const parsedConsultation = Number(consultationFeeCents);
    const parsedMedication = Number(medicationCostCents);
    if (
      !Number.isInteger(parsedConsultation) || parsedConsultation < 0 ||
      !Number.isInteger(parsedMedication) || parsedMedication < 0 ||
      !Number.isInteger(parsedShipping) || parsedShipping < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid fields: consultationFeeCents, medicationCostCents, shippingFeeCents must be non-negative integers",
        },
        { status: 400 },
      );
    }

    let existingPayments = null;

    {
      const { data } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("prescription_id", primaryPrescriptionId)
        .in("payment_status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);
      existingPayments = data;
    }

    if (!existingPayments?.length) {
      const { data: linkedTxs } = await supabase
        .from("prescriptions")
        .select("payment_transaction_id")
        .in("id", prescriptionIds)
        .not("payment_transaction_id", "is", null);

      if (linkedTxs && linkedTxs.length > 0) {
        const txIds = [...new Set(linkedTxs.map(r => r.payment_transaction_id).filter(Boolean))];
        if (txIds.length > 0) {
          const { data: activeTxs } = await supabase
            .from("payment_transactions")
            .select("*")
            .in("id", txIds)
            .in("payment_status", ["pending", "processing"])
            .order("created_at", { ascending: false })
            .limit(1);
          if (activeTxs?.length) {
            existingPayments = activeTxs;
          }
        }
      }
    }

    if (!existingPayments?.length) {
      const { data: primaryRx } = await supabase
        .from("prescriptions")
        .select("order_group_id")
        .eq("id", primaryPrescriptionId)
        .single();

      if (primaryRx?.order_group_id) {
        const { data: groupTxs } = await supabase
          .from("prescriptions")
          .select("payment_transaction_id")
          .eq("order_group_id", primaryRx.order_group_id)
          .not("payment_transaction_id", "is", null);

        if (groupTxs && groupTxs.length > 0) {
          const txIds = [...new Set(groupTxs.map(r => r.payment_transaction_id).filter(Boolean))];
          if (txIds.length > 0) {
            const { data: activeTxs } = await supabase
              .from("payment_transactions")
              .select("*")
              .in("id", txIds)
              .in("payment_status", ["pending", "processing"])
              .order("created_at", { ascending: false })
              .limit(1);
            if (activeTxs?.length) {
              existingPayments = activeTxs;
            }
          }
        }
      }
    }

    let existingPayment = existingPayments?.[0] || null;

    // STALE LINK INVALIDATION (Greenwich/Rahmany incident, May 2026):
    // Even if a found pending tx is not time-expired, it may be STALE
    // because the requested set of prescription IDs has changed (e.g., the
    // group composition was updated, or an earlier partial bill was issued
    // for a smaller set). If the linked rx set does not match what the
    // caller is asking us to bill now, expire the stale tx and create a
    // fresh one — otherwise the patient would be served the wrong amount.
    let isStaleByLinkSet = false;
    if (existingPayment) {
      const { data: linkedRxsForStale } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("payment_transaction_id", existingPayment.id);

      const linkedSet = new Set((linkedRxsForStale || []).map((r) => r.id));
      const requestedSetForStale = new Set(prescriptionIds);

      const sameSet =
        linkedSet.size === requestedSetForStale.size &&
        [...linkedSet].every((id) => requestedSetForStale.has(id));

      if (!sameSet) {
        isStaleByLinkSet = true;
        console.warn(
          `[generate-link][STALE-LINK] Existing tx ${existingPayment.id} links rxs=[${[...linkedSet].join(",")}] but request asks for rxs=[${prescriptionIds.join(",")}]. Expiring stale link and creating fresh one.`,
        );
      }
    }

    if (existingPayment) {
      // Time-based expiration removed (Joseph rule, May 11 2026 — Jessica
      // Carroll incident). The only remaining trigger for invalidating an
      // existing pending tx in this path is the stale-by-link-set check
      // (different rx group composition). Time alone never invalidates a
      // link anymore.
      if (isStaleByLinkSet) {
        // ──────────────────────────────────────────────────────────────────
        // RACE-SAFE STALE/EXPIRED INVALIDATION (architect-mandated CAS)
        // ──────────────────────────────────────────────────────────────────
        // Without a CAS predicate, a concurrent webhook capture or
        // verify-and-complete could flip the tx to 'completed' between
        // our SELECT above and the UPDATE below — and we'd silently
        // overwrite a successful payment back to 'expired' AND unlink
        // its prescriptions. The CAS clause restricts the UPDATE to txs
        // still in a non-terminal state; .select("id") returns the
        // updated rows so we can gate the unlink on actual write success.
        const { data: expireResult } = await supabase
          .from("payment_transactions")
          .update({
            payment_status: "expired",
            payment_link_expires_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            reconciliation_note: isStaleByLinkSet
              ? `Auto-expired: linked rx set did not match new bill request (stale link)`
              : `Auto-expired: payment link past expiration`,
          })
          .eq("id", existingPayment.id)
          .in("payment_status", ["pending", "processing"])
          .select("id");

        if (expireResult && expireResult.length > 0) {
          // CAS succeeded — safe to unlink the prescriptions that
          // pointed to this (still-non-terminal) tx.
          await supabase
            .from("prescriptions")
            .update({
              payment_transaction_id: null,
              payment_status: "pending",
            })
            .eq("payment_transaction_id", existingPayment.id);

          existingPayment = null; // fall through to create a new link
        } else {
          // CAS failed — tx already moved to a terminal state
          // (completed/refunded/voided) by a concurrent process.
          // Re-read to see if it became completed; if so, we should
          // NOT issue a new link and instead 409 the caller so the
          // admin sees a fresh state and can decide what to do.
          const { data: refreshedTx } = await supabase
            .from("payment_transactions")
            .select("id, payment_status, total_amount_cents, payment_token, payment_link_url")
            .eq("id", existingPayment.id)
            .single();

          console.warn(
            `[generate-link][CAS-FAIL] Concurrent state change on tx ${existingPayment.id} during invalidation. New status=${refreshedTx?.payment_status}. Returning 409 instead of issuing new link.`,
          );

          return NextResponse.json(
            {
              error: "PAYMENT_TX_RACE",
              message:
                "The existing payment for this prescription was just updated by another process. Refresh the page and try again.",
              currentStatus: refreshedTx?.payment_status || "unknown",
              transactionId: existingPayment.id,
            },
            { status: 409 },
          );
        }
      }
    }

    if (existingPayment) {
      // Payment link still valid AND covers the same rx set — return existing link and resend email
      {
        const patient = Array.isArray(prescription.patient)
          ? prescription.patient[0]
          : prescription.patient;

        const providerUserId = isAdmin ? prescription.prescriber_id : (userId || prescription.prescriber_id);
        const { data: provider } = await supabase
          .from("providers")
          .select("id, prefix, first_name, last_name")
          .eq("user_id", providerUserId)
          .single();

        // Build email payload, then fire-and-forget — never block response on
        // SendGrid latency. Internal fetch hops on Render can deadlock if
        // awaited, which is what stranded providers on the "Processing..." spinner.
        const appUrl =
          envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

        if (sendEmail && (patientEmail || patient?.email)) {
          let resendMedications: Array<{ name: string; price?: string; shippingFee?: string }> | undefined;
          if (prescriptionIds.length > 1) {
            const { data: allMeds } = await supabase
              .from("prescriptions")
              .select("medication, patient_price, shipping_fee_cents")
              .in("id", prescriptionIds);
            if (allMeds && allMeds.length > 1) {
              resendMedications = allMeds.map((m) => ({
                name: m.medication || "Medication",
                price: m.patient_price ? Number(m.patient_price).toFixed(2) : undefined,
                shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
              }));
            }
          }
          const emailBody = JSON.stringify({
            patientEmail: patientEmail || patient?.email,
            patientPhone: patient?.phone || undefined,
            patientName: patient
              ? `${patient.first_name} ${patient.last_name}`
              : "Valued Patient",
            providerName: provider
              ? `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}`
              : "Your Provider",
            medication: prescription.medication,
            medications: resendMedications,
            totalAmount: (existingPayment.total_amount_cents / 100).toFixed(2),
            paymentUrl: existingPayment.payment_link_url,
            paymentToken: existingPayment.payment_token,
          });

          // Fire and forget — DO NOT await
          void fetch(`${appUrl}/api/payments/send-payment-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-api-key": INTERNAL_API_KEY || "",
            },
            body: emailBody,
          }).catch((err) =>
            console.error("[GENERATE-LINK] resend email failed (non-fatal):", err),
          );
        }

        return NextResponse.json({
          success: true,
          existing: true,
          message:
            "A payment link was already generated for this prescription. Email queued for delivery.",
          paymentUrl: existingPayment.payment_link_url,
          paymentToken: existingPayment.payment_token,
          transactionId: existingPayment.id,
          expiresAt: existingPayment.payment_link_expires_at,
          emailSent: sendEmail && !!(patientEmail || patient?.email),
        });
      }
    }

    for (const rxId of prescriptionIds) {
      const { data: claimed } = await supabase
        .from("prescriptions")
        .update({ payment_status: "link_generating" })
        .eq("id", rxId)
        .eq("payment_status", "pending")
        .select("id");
      if (claimed && claimed.length > 0) {
        claimedRxIds.push(rxId);
      }
    }

    if (claimedRxIds.length !== prescriptionIds.length) {
      for (const rxId of claimedRxIds) {
        await supabase
          .from("prescriptions")
          .update({ payment_status: "pending" })
          .eq("id", rxId)
          .eq("payment_status", "link_generating");
      }
      claimedRxIds.length = 0;
      return NextResponse.json(
        { error: "One or more prescriptions are already being processed for payment" },
        { status: 409 },
      );
    }

    async function revertLinkClaim() {
      for (const rxId of prescriptionIds) {
        await supabase
          .from("prescriptions")
          .update({ payment_status: "pending" })
          .eq("id", rxId)
          .eq("payment_status", "link_generating");
      }
    }

    const newLinkProviderUserId = isAdmin ? prescription.prescriber_id : (userId || prescription.prescriber_id);
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, prefix, first_name, last_name")
      .eq("user_id", newLinkProviderUserId)
      .single();

    if (providerError || !provider) {
      await revertLinkClaim();
      return NextResponse.json(
        { error: "Provider profile not found" },
        { status: 404 },
      );
    }

    if (!envConfig.AUTHNET_API_LOGIN_ID || !envConfig.AUTHNET_TRANSACTION_KEY) {
      await revertLinkClaim();
      return NextResponse.json(
        {
          error: "Payment system not configured. Please contact administrator.",
        },
        { status: 500 },
      );
    }

    // Calculate total from DB (server-authoritative) — patient pays patient_price + shipping + oversight fees
    let serverTotalMedCents = 0;
    let serverTotalShipCents = 0;
    let serverTotalOversightCents = 0;

    {
      const { data: dbRxPrices } = await supabase
        .from("prescriptions")
        .select("patient_price, shipping_fee_cents, profit_cents")
        .in("id", prescriptionIds);

      if (dbRxPrices && dbRxPrices.length > 0) {
        for (const rx of dbRxPrices) {
          const pp = rx.patient_price ? parseFloat(rx.patient_price) : 0;
          serverTotalMedCents += Number.isFinite(pp) ? Math.round(pp * 100) : 0;
          serverTotalShipCents += rx.shipping_fee_cents || 0;
          serverTotalOversightCents += rx.profit_cents || 0;
        }
      }
    }

    const serverTotalCents = serverTotalMedCents + serverTotalShipCents + serverTotalOversightCents;
    const clientTotalCents = parsedConsultation + parsedMedication + parsedShipping;

    // Use server-computed total when available; fall back to client if DB prices not set yet
    const totalAmountCents = serverTotalCents > 0 ? serverTotalCents : clientTotalCents;

    if (serverTotalCents > 0 && Math.abs(serverTotalCents - clientTotalCents) > 1) {
      console.warn(`[GENERATE-LINK] Amount mismatch: client=${clientTotalCents} server=${serverTotalCents} for rxIds=${prescriptionIds.join(",")}`);
    }

    const totalAmountDollars = (totalAmountCents / 100).toFixed(2);

    // Generate unique payment token (for patient magic link URL)
    const paymentToken = crypto.randomBytes(32).toString("hex");

    // Generate unique Authorize.Net reference ID (20 chars max for Authorize.Net compatibility)
    const authnetRefId =
      `PAY${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`.substring(
        0,
        20,
      );

    // Create payment transaction record
    const patient = Array.isArray(prescription.patient)
      ? prescription.patient[0]
      : prescription.patient;
    const pharmacy = Array.isArray(prescription.pharmacy)
      ? prescription.pharmacy[0]
      : prescription.pharmacy;

    let medicationNames = prescription.medication;
    let medicationsArray: Array<{ name: string; price?: string; shippingFee?: string }> | undefined;
    let genLinkOversightCents = 0;
    if (prescriptionIds.length > 1) {
      const { data: allMeds } = await supabase
        .from("prescriptions")
        .select("medication, patient_price, shipping_fee_cents, profit_cents")
        .in("id", prescriptionIds);
      if (allMeds && allMeds.length > 1) {
        medicationNames = allMeds.map((m) => m.medication).join(", ");
        medicationsArray = allMeds.map((m) => ({
          name: m.medication || "Medication",
          price: m.patient_price ? Number(m.patient_price).toFixed(2) : undefined,
          shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
        }));
        genLinkOversightCents = allMeds.reduce((sum, m) => sum + (m.profit_cents || 0), 0);
      } else {
        medicationNames = `${prescriptionIds.length} medications`;
      }
    }

    const { data: paymentTransaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        prescription_id: primaryPrescriptionId,
        total_amount_cents: totalAmountCents,
        consultation_fee_cents: serverTotalOversightCents > 0 ? serverTotalOversightCents : parsedConsultation,
        medication_cost_cents: serverTotalCents > 0 ? serverTotalMedCents : parsedMedication,
        shipping_fee_cents: serverTotalCents > 0 ? serverTotalShipCents : parsedShipping,
        patient_id: prescription.patient_id,
        patient_email: patient?.email,
        patient_phone: patient?.phone,
        patient_name: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown",
        provider_id: provider.id,
        provider_name: `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}`,
        pharmacy_id: prescription.pharmacy_id,
        pharmacy_name: pharmacy?.name,
        send_receipt_to_patient: sendReceiptToPatient !== false,
        payment_token: paymentToken,
        authnet_ref_id: authnetRefId,
        payment_status: "pending",
        order_progress: "payment_pending",
        description:
          description ||
          `Payment for ${medicationNames} - ${patient?.first_name} ${patient?.last_name}`,
        // payment_link_expires_at intentionally NOT set — Joseph rule
        // (May 11 2026): payment links never expire.
        payment_link_expires_at: null,
      })
      .select()
      .single();

    if (transactionError) {
      await revertLinkClaim();
      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500 },
      );
    }

    // Use the hosted payment flow - redirect to our payment overview page
    // which will then redirect to Authorize.Net's hosted payment page
    const appUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";
    const fullPaymentUrl = `${appUrl}/payment/${paymentToken}`;

    // Update payment transaction with the payment URL
    await supabase
      .from("payment_transactions")
      .update({
        payment_link_url: fullPaymentUrl,
      })
      .eq("id", paymentTransaction.id);

    for (const rxId of prescriptionIds) {
      await supabase
        .from("prescriptions")
        .update({
          payment_status: "pending",
          payment_transaction_id: paymentTransaction.id,
        })
        .eq("id", rxId);
    }

    claimedRxIds.length = 0;

    // Fire-and-forget the email send. The link is already persisted; the
    // patient notification is best-effort and must not block the response.
    // Awaiting an internal fetch on Render can deadlock and hang the modal.
    if (sendEmail && (patientEmail || patient?.email)) {
      const emailBody = JSON.stringify({
        patientEmail: patientEmail || patient?.email,
        patientPhone: patient?.phone || undefined,
        patientName: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Valued Patient",
        providerName: `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}`,
        medication: medicationNames,
        medications: medicationsArray,
        ...(genLinkOversightCents > 0
          ? { oversightFee: (genLinkOversightCents / 100).toFixed(2) }
          : {}),
        totalAmount: totalAmountDollars,
        paymentUrl: fullPaymentUrl,
        paymentToken,
      });

      void fetch(`${appUrl}/api/payments/send-payment-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": INTERNAL_API_KEY || "",
        },
        body: emailBody,
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error(
              "[GENERATE-LINK] email send returned non-OK:",
              res.status,
            );
          }
        })
        .catch((err) =>
          console.error("[GENERATE-LINK] email send failed (non-fatal):", err),
        );
    }

    return NextResponse.json({
      success: true,
      paymentUrl: fullPaymentUrl,
      paymentToken,
      transactionId: paymentTransaction.id,
      expiresAt: paymentTransaction.payment_link_expires_at,
      emailSent: sendEmail && !!(patientEmail || patient?.email),
    });
  } catch (error) {
    console.error("[GENERATE-LINK] ========== FATAL ERROR ==========");
    console.error(
      "[GENERATE-LINK] Error:",
      error instanceof Error ? error.message : String(error),
    );

    if (claimedRxIds.length > 0) {
      try {
        for (const rxId of claimedRxIds) {
          await supabaseOuter
            .from("prescriptions")
            .update({ payment_status: "pending" })
            .eq("id", rxId)
            .eq("payment_status", "link_generating");
        }
      } catch {
        console.error("[GENERATE-LINK] CRITICAL: Failed to revert link_generating claims");
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate payment link",
      },
      { status: 500 },
    );
  }
}
