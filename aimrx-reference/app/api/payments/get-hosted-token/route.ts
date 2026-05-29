import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";
import {
  STALE_PROCESSING_MS,
  CHARGE_IN_FLIGHT_MS,
} from "@/app/api/payments/_lib/constants";

/**
 * Authorize.Net API endpoints
 */
const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

const AUTHNET_HOSTED_URLS = {
  sandbox: "https://test.authorize.net/payment/payment",
  production: "https://accept.authorize.net/payment/payment",
} as const;

/**
 * POST /api/payments/get-hosted-token
 * Get an Accept Hosted form token from Authorize.Net
 * This token is used to redirect the user to Authorize.Net's hosted payment page
 */
export async function POST(request: NextRequest) {
  let claimedTransactionId: string | null = null;
  try {
    const body = await request.json();
    const { paymentToken, from, inline, sendReceiptToPatient } = body;

    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 },
      );
    }

    // Inline (in-modal iframe) callers MUST be authenticated staff. The
    // patient-link path remains anonymous because possession of the
    // payment_token in the URL is the auth factor for that path.
    if (inline) {
      const { user, userRole } = await getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 },
        );
      }
      if (
        userRole !== "provider" &&
        userRole !== "delegate" &&
        userRole !== "admin" &&
        userRole !== "super_admin"
      ) {
        return NextResponse.json(
          { success: false, error: "Provider or admin access required" },
          { status: 403 },
        );
      }
    }

    // Validate Authorize.Net credentials are configured
    if (!envConfig.AUTHNET_API_LOGIN_ID || !envConfig.AUTHNET_TRANSACTION_KEY) {
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 },
      );
    }

    const supabase = createAdminClient();

    // Get payment transaction by token
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", paymentToken)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    if (transaction.payment_status === "completed") {
      return NextResponse.json(
        { success: false, error: "Payment has already been completed" },
        { status: 400 },
      );
    }

    // Stale-claim recovery: a row stuck in 'processing' beyond
    // STALE_PROCESSING_MS is treated as an abandoned attempt (closed tab,
    // network drop, deploy in the middle of a charge). Atomic claim guard
    // (CAS on updated_at) prevents double-charge even at this short window.
    const isStaleProcessing =
      transaction.payment_status === "processing" &&
      transaction.updated_at &&
      Date.now() - new Date(transaction.updated_at).getTime() >
        STALE_PROCESSING_MS;

    // CHARGE_IN_FLIGHT guard: a charge_attempt_started_at written by
    // /api/payments/charge-nonce within the last CHARGE_IN_FLIGHT_MS means
    // a real Authorize.Net call is mid-flight. We refuse the entire path
    // (claim, stale-claim, re-lease) until the window closes — a second
    // hosted-form token issued during this window is a real double-charge
    // primitive that the gateway cannot itself prevent (single-use only
    // protects re-submission of the SAME token; two separately issued
    // tokens are two separate charges from Authorize.net's perspective).
    const chargeInFlight =
      transaction.charge_attempt_started_at &&
      Date.now() -
          new Date(transaction.charge_attempt_started_at).getTime() <
        CHARGE_IN_FLIGHT_MS;

    if (chargeInFlight) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A charge is currently being processed for this payment. Please wait a moment and try again.",
          code: "CHARGE_IN_FLIGHT",
        },
        { status: 409 },
      );
    }

    if (transaction.payment_status === "processing" && !isStaleProcessing) {
      return NextResponse.json(
        { success: false, error: "Payment is currently being processed. Please wait a moment and try again." },
        { status: 409 },
      );
    }

    // Payment link expiration DISABLED (May 11 2026, Jessica Carroll
    // incident — Joseph rule "cancell the expiration of all payment links
    // across the app"). Links are evergreen. The time-based gate is
    // intentionally removed; rows only become unusable through explicit
    // terminal statuses (paid / refunded / cancelled / admin regenerate).

    // Atomic claim, expressed as TWO separate atomic UPDATEs instead of one
    // PostgREST .or() with a nested .and(). The .or() form was silently
    // failing because it embeds an ISO timestamp value containing dots
    // (`.000Z` milliseconds) into the .or() filter expression — PostgREST
    // treats dots as field separators, so the predicate parsed wrong and
    // the UPDATE returned zero rows even for a clean pending row. Live
    // patients hit "This payment is no longer available" on healthy
    // pending links because of this. Two-query form is unambiguous and
    // each UPDATE is its own atomic, single-row, race-safe operation.
    //
    // Try 1: claim from pending. The DB serializes concurrent UPDATEs on
    //   the same row, so at most one caller wins.
    // Try 2: if (1) didn't claim, try to claim from STALE processing
    //   (status=processing AND updated_at < cutoff). The first winner
    //   here also refreshes updated_at to now(), so any concurrent caller
    //   will see updated_at >= cutoff and correctly fail.
    const staleCutoffIso = new Date(
      Date.now() - STALE_PROCESSING_MS,
    ).toISOString();
    let { data: claimedRows } = await supabase
      .from("payment_transactions")
      .update({ payment_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", transaction.id)
      .eq("payment_status", "pending")
      .select("id");
    if (!claimedRows || claimedRows.length === 0) {
      const { data: staleClaimedRows } = await supabase
        .from("payment_transactions")
        .update({ payment_status: "processing", updated_at: new Date().toISOString() })
        .eq("id", transaction.id)
        .eq("payment_status", "processing")
        .lt("updated_at", staleCutoffIso)
        .select("id");
      claimedRows = staleClaimedRows;
    }

    if (!claimedRows || claimedRows.length === 0) {
      // Soft re-lease, narrowly gated: only allow when the row was ALREADY
      // 'processing' at read time. That guarantees this is a staff RETRY of
      // a previously-claimed attempt (closed iframe, network blip), not two
      // concurrent first-time clicks racing pending->processing. Without
      // this gate, two simultaneous Charge Now clicks could BOTH end up with
      // valid hosted form tokens for the same transaction — a real
      // double-charge risk that the gateway alone cannot guarantee to block
      // (single-use only protects re-submission of the SAME token; two
      // separately issued tokens are two separate charges from Authorize.net's
      // perspective).
      //
      // Race analysis with this gate in place:
      //   Reader saw 'pending', atomic claim lost  -> another caller just
      //     won the pending->processing race. Return 409. NEVER re-lease.
      //   Reader saw 'processing', atomic claim lost  -> the row is held by
      //     a recent prior attempt; safe to reclaim and re-issue, because
      //     the 'pending' claim path is closed (no concurrent first-time
      //     winner can exist).
      const wasAlreadyProcessing = transaction.payment_status === "processing";
      if (!wasAlreadyProcessing) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Payment is being processed by another request. Please wait a moment and try again.",
            code: "RELEASE_RACE_LOST",
          },
          { status: 409 },
        );
      }
      // Compare-and-swap on updated_at: the soft re-lease must only win
      // for the caller whose snapshot of the row is still current. If
      // ANY other request mutated the row between our read and this
      // UPDATE (another re-lease winner, a verify cycle, a release, a
      // charge that wrote charge_attempt_started_at), updated_at has
      // moved and this UPDATE matches zero rows. Without this CAS, two
      // concurrent re-lease callers could BOTH receive a hosted form
      // token for the same intent.
      const { data: releasedRows } = await supabase
        .from("payment_transactions")
        .update({
          payment_status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .eq("payment_status", "processing")
        .eq("updated_at", transaction.updated_at)
        .select("id");
      if (!releasedRows || releasedRows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This payment is no longer available. Please refresh and try again.",
            code: "ROW_GONE",
          },
          { status: 409 },
        );
      }
    }

    claimedTransactionId = transaction.id;

    // Authoritatively (re)write send_receipt_to_patient AFTER we won the
    // pending->processing claim. Doing it post-claim guarantees a 409'd
    // concurrent request cannot taint the row's preference and cause an
    // unintended receipt leak.
    //   - inline (legacy provider iframe — removed Apr 25 2026): use the
    //     checkbox state. If the provider didn't pass the flag, leave the
    //     row alone.
    //   - from=provider-dashboard (provider Charge Now external redirect):
    //     respect the row's existing preference. generate-link already wrote
    //     the provider's checkbox choice when the token was minted, so
    //     forcing TRUE here would silently override a provider who chose
    //     NOT to send a receipt — the privacy regression the architect
    //     flagged on the Phase 1 review.
    //   - patient paying via emailed Send Link (default non-inline): force
    //     TRUE so a prior canceled Charge Now cannot suppress the receipt
    //     the patient is expecting when they pay through their own link.
    {
      let desired: boolean | null = null;
      if (inline) {
        if (typeof sendReceiptToPatient === "boolean") {
          desired = sendReceiptToPatient !== false;
        }
      } else if (from === "provider-dashboard") {
        // Provider-initiated external redirect.
        // - If the modal forwarded the current checkbox state (srp query
        //   param → sendReceiptToPatient body field), apply it. This is
        //   the authoritative refresh for reused payment_tokens where
        //   generate-link was skipped and the row may hold a stale
        //   preference (e.g., TRUE from a prior Send Link mint).
        // - Otherwise, leave the row alone (respect what generate-link
        //   wrote when the token was first created).
        if (typeof sendReceiptToPatient === "boolean") {
          desired = sendReceiptToPatient !== false;
        } else {
          desired = null;
        }
      } else {
        desired = true;
      }
      if (desired !== null && transaction.send_receipt_to_patient !== desired) {
        await supabase
          .from("payment_transactions")
          .update({ send_receipt_to_patient: desired, updated_at: new Date().toISOString() })
          .eq("id", transaction.id);
        transaction.send_receipt_to_patient = desired;
      }
    }

    // Defensive guard (Keith Robinson incident, May 7 2026): if the row
    // is missing authnet_ref_id (e.g. legacy rows, support-team reset, or
    // a generate-link bug), AuthNet would receive an EMPTY invoiceNumber
    // — which makes the transaction unfindable by the reconciler later.
    // Generate one on-demand and persist it before building the form so
    // every hosted-form session always carries a non-empty invoice that
    // the reconciler can match against. Same 20-char format used by
    // generate-link.
    if (!transaction.authnet_ref_id || transaction.authnet_ref_id === "") {
      const generatedRefId =
        `PAY${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`.substring(
          0,
          20,
        );
      const { error: refIdErr } = await supabase
        .from("payment_transactions")
        .update({ authnet_ref_id: generatedRefId, updated_at: new Date().toISOString() })
        .eq("id", transaction.id);
      if (refIdErr) {
        console.error("[get-hosted-token] Failed to backfill authnet_ref_id:", refIdErr.message);
      }
      transaction.authnet_ref_id = generatedRefId;
    }

    const totalAmountDollars = (transaction.total_amount_cents / 100).toFixed(
      2,
    );

    const siteUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

    // Look up the patient's saved billing/physical address so the hosted
    // form opens pre-filled. Without this, staff using "Charge Now" must
    // type the billing address themselves and frequently mismatch what's on
    // file with the issuer, causing AVS rejections.
    type SavedAddress = {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      zip?: string;
      country?: string;
    } | null;

    let billToFirstName = "";
    let billToLastName = "";
    let billToAddress: SavedAddress = null;

    if (transaction.patient_id) {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("first_name, last_name, physical_address, billing_address")
        .eq("id", transaction.patient_id)
        .maybeSingle();
      if (patientRow) {
        billToFirstName = patientRow.first_name || "";
        billToLastName = patientRow.last_name || "";
        // Pick billing_address only if it has real content. An empty object
        // {} is truthy in JS, so a bare `||` fallback would incorrectly
        // prefer an empty billing_address over a populated physical_address
        // (the patient's shipping address). Fall through to physical_address
        // when billing has no usable street/city/state/zip.
        const hasContent = (a: SavedAddress) =>
          !!a &&
          !!(
            a.street ||
            a.city ||
            a.state ||
            a.zipCode ||
            a.zip
          );
        const billing = patientRow.billing_address as SavedAddress;
        const physical = patientRow.physical_address as SavedAddress;
        billToAddress = hasContent(billing)
          ? billing
          : hasContent(physical)
            ? physical
            : null;
      }
    }

    if ((!billToFirstName || !billToLastName) && transaction.patient_name) {
      const parts = String(transaction.patient_name).trim().split(/\s+/);
      if (!billToFirstName) billToFirstName = parts[0] || "";
      if (!billToLastName) billToLastName = parts.slice(1).join(" ") || "";
    }

    const billToZip = billToAddress?.zipCode || billToAddress?.zip || "";
    const hasUsableAddress = Boolean(
      billToAddress?.street &&
        billToAddress?.city &&
        billToAddress?.state &&
        billToZip,
    );

    // Authorize.Net field length limits (per AIM API spec)
    const trim = (v: string, max: number) => (v || "").slice(0, max);
    const billTo = {
      firstName: trim(billToFirstName, 50),
      lastName: trim(billToLastName, 50),
      ...(hasUsableAddress
        ? {
            address: trim(billToAddress?.street || "", 60),
            city: trim(billToAddress?.city || "", 40),
            state: trim(billToAddress?.state || "", 40),
            zip: trim(billToZip, 20),
            country: trim(billToAddress?.country || "USA", 60),
          }
        : {}),
    };

    // Build the getHostedPaymentPageRequest
    const hostedPaymentRequest = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: envConfig.AUTHNET_API_LOGIN_ID,
          transactionKey: envConfig.AUTHNET_TRANSACTION_KEY,
        },
        refId: transaction.authnet_ref_id,
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: totalAmountDollars,
          order: {
            invoiceNumber: transaction.authnet_ref_id,
            description: transaction.description || "Prescription Payment",
          },
          customer: {
            email: transaction.patient_email || "",
          },
          billTo,
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: "hostedPaymentReturnOptions",
              settingValue: JSON.stringify({
                showReceipt: !inline,
                url: `${siteUrl}/payment/success/${paymentToken}?from=${from || "patient-link"}`,
                urlText: "Continue",
                cancelUrl: inline ? `${siteUrl}/payment/cancel` : siteUrl,
                cancelUrlText: "Cancel",
              }),
            },
            ...(inline
              ? [
                  {
                    settingName: "hostedPaymentIFrameCommunicatorUrl",
                    settingValue: JSON.stringify({
                      url: `${siteUrl}/authnet-iframe-communicator.html`,
                    }),
                  },
                ]
              : []),
            {
              settingName: "hostedPaymentButtonOptions",
              settingValue: JSON.stringify({
                text: "Pay Now",
              }),
            },
            {
              settingName: "hostedPaymentOrderOptions",
              settingValue: JSON.stringify({
                show: true,
                merchantName: "AIMRX",
              }),
            },
            {
              settingName: "hostedPaymentBillingAddressOptions",
              settingValue: JSON.stringify({
                show: true,
                required: true,
              }),
            },
            {
              settingName: "hostedPaymentCustomerOptions",
              settingValue: JSON.stringify({
                showEmail: true,
                requiredEmail: true,
              }),
            },

            {
              settingName: "hostedPaymentPaymentOptions",
              settingValue: JSON.stringify({
                cardCodeRequired: true,
                showCreditCard: true,
                showBankAccount: false,
              }),
            },
            {
              settingName: "hostedPaymentSecurityOptions",
              settingValue: JSON.stringify({
                captcha: false,
              }),
            },
          ],
        },
      },
    };

    // Determine API URL based on environment
    const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];
    const hostedUrl = AUTHNET_HOSTED_URLS[envConfig.AUTHNET_ENVIRONMENT];

    // Call Authorize.Net API
    const authnetResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(hostedPaymentRequest),
    });

    const authnetData = await authnetResponse.json();

    if (authnetData.messages?.resultCode !== "Ok" || !authnetData.token) {
      const errorMessage =
        authnetData.messages?.message?.[0]?.text ||
        "Failed to get hosted payment token";

      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending", updated_at: new Date().toISOString() })
        .eq("id", transaction.id);

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 },
      );
    }

    await supabase
      .from("payment_transactions")
      .update({
        payment_link_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return NextResponse.json({
      success: true,
      formToken: authnetData.token,
      paymentUrl: hostedUrl,
    });
  } catch (error) {
    console.error(
      "[HOSTED-TOKEN] Error:",
      error instanceof Error ? error.message : "Unknown",
    );

    if (claimedTransactionId) {
      try {
        const revertSupabase = createAdminClient();
        await revertSupabase
          .from("payment_transactions")
          .update({ payment_status: "pending", updated_at: new Date().toISOString() })
          .eq("id", claimedTransactionId)
          .eq("payment_status", "processing");
      } catch {
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize payment",
      },
      { status: 500 },
    );
  }
}
