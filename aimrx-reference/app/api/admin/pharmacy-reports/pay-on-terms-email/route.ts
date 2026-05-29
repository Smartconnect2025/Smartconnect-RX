/**
 * Pay-on-Terms Email Report — Manual "Send Now"
 *
 * Sends an HTML reconciliation report for prescriptions submitted within a
 * specific date window on a pay-on-terms provider. Admin/super_admin only.
 *
 * The window is supplied by the dialog (From/To pickers + presets); if the
 * caller omits both, we default to "today so far" in US Eastern so the
 * endpoint stays usable for ad-hoc curl/cron testing.
 *
 * Optional pharmacy/provider filters from the dashboard further narrow the
 * report contents (e.g. "send me the report for Greenwich only").
 */

import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import {
  buildPayOnTermsEmail,
  describeCadence,
  type PotEmailRow,
  type PotEmailWindow,
} from "../_shared/build-pot-email";
import {
  resolveScheduledWindow,
  windowFromYmdRange,
} from "../_shared/period-window";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com";
const PAY_ON_TERMS_REPORT_EMAIL =
  process.env.PAY_ON_TERMS_REPORT_EMAIL || process.env.ADMIN_ALERT_EMAIL || "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface RequestBody {
  recipients?: string[];
  /**
   * Reporting window. Either:
   *   - { fromYmd: "YYYY-MM-DD", toYmd: "YYYY-MM-DD" } (Eastern dates, both inclusive), OR
   *   - omitted → defaults to "today so far" Eastern.
   */
  window?: {
    fromYmd?: string;
    toYmd?: string;
  };
  /**
   * Dashboard filters that further narrow the report contents.
   * `startDate`/`endDate` here are LEGACY page filters; if `window` is
   * provided they are ignored (the explicit window wins).
   */
  filters?: {
    pharmacyId?: string;
    providerId?: string;
    delegationId?: string;
    groupId?: string;
    platformManagerId?: string;
    /** Free-text search on patient/medication/provider/pharmacy name. */
    searchTerm?: string;
    startDate?: string;
    endDate?: string;
  };
  /**
   * Mirror the Pay-on-Terms tab "Show settled" toggle. When true, the
   * email includes settled and card-paid rows (matching the on-screen
   * "Show settled" view). When false/omitted, the email shows only
   * outstanding rows (matching the default view). The goal is "print
   * what's on the screen".
   */
  includeSettled?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    // ---- Resolve recipients ----
    const explicitRecipients =
      body.recipients === null || body.recipients === undefined
        ? undefined
        : body.recipients;

    if (explicitRecipients !== undefined) {
      if (
        !Array.isArray(explicitRecipients) ||
        explicitRecipients.some((r) => typeof r !== "string")
      ) {
        return NextResponse.json(
          { error: "`recipients` must be an array of email strings" },
          { status: 400 },
        );
      }
    }

    const supabaseEarly = await createServerClient();
    let recipients: string[];
    if (explicitRecipients !== undefined) {
      if (explicitRecipients.length === 0) {
        return NextResponse.json(
          { error: "`recipients` cannot be an empty array" },
          { status: 400 },
        );
      }
      recipients = explicitRecipients.map((r) => r.trim()).filter(Boolean);
      if (recipients.length === 0) {
        return NextResponse.json(
          { error: "`recipients` cannot be all-whitespace" },
          { status: 400 },
        );
      }
    } else {
      const { data: dbRecipients } = await supabaseEarly
        .from("pay_on_terms_email_recipients")
        .select("email, enabled")
        .eq("enabled", true);
      const dbList = (dbRecipients || []).map((r) => r.email).filter(Boolean);
      if (dbList.length > 0) {
        recipients = dbList;
      } else if (PAY_ON_TERMS_REPORT_EMAIL) {
        recipients = [PAY_ON_TERMS_REPORT_EMAIL];
      } else {
        return NextResponse.json(
          {
            error:
              "No recipients configured. Add at least one recipient under 'Manage recipients' in the Email dialog.",
          },
          { status: 400 },
        );
      }
    }
    const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Invalid recipient email(s)", invalid },
        { status: 400 },
      );
    }

    // ---- Resolve the reporting window ----
    let reportWindow: PotEmailWindow;
    try {
      if (body.window?.fromYmd && body.window?.toYmd) {
        const w = windowFromYmdRange(body.window.fromYmd, body.window.toYmd);
        reportWindow = {
          start: w.start,
          end: w.end,
          label: w.label,
          shortLabel: w.shortLabel,
        };
      } else {
        // Default: "today so far" in Eastern (frequency="off" branch).
        const w = resolveScheduledWindow("off", new Date());
        reportWindow = {
          start: w.start,
          end: w.end,
          label: w.label,
          shortLabel: w.shortLabel,
        };
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid window" },
        { status: 400 },
      );
    }

    const filters = body.filters || {};
    const supabase = await createServerClient();

    // ---- Pull all Rx submitted in window (regardless of settlement) ----
    let rxQuery = supabase
      .from("prescriptions")
      .select(
        "id, queue_id, prescriber_id, patient_id, medication, medication_id, patient_price, shipping_fee_cents, profit_cents, submitted_at, pay_on_terms_settled_at, pharmacy_id, status, payment_transaction_id, submitted_by_delegation_id",
      )
      .gte("submitted_at", reportWindow.start.toISOString())
      .lt("submitted_at", reportWindow.end.toISOString())
      // Include `paused` (Greenwich "In Production") so actively-compounded
      // orders show up in the pay-on-terms report. Without this they
      // disappeared from the report mid-cycle.
      .in("status", ["submitted", "billing", "approved", "paused", "packed", "shipped", "delivered"]);

    if (filters.pharmacyId) rxQuery = rxQuery.eq("pharmacy_id", filters.pharmacyId);
    // Mirror the same `delegationId` server filter the main reports
    // route applies — Rx submitted by that delegation only.
    if (filters.delegationId) {
      rxQuery = rxQuery.eq("submitted_by_delegation_id", filters.delegationId);
    }

    const { data: prescriptions, error: rxErr } = await rxQuery;
    if (rxErr) {
      console.error("[pay-on-terms-email] rx fetch error:", rxErr);
      return NextResponse.json({ error: "Failed to load prescriptions" }, { status: 500 });
    }

    const prescriberIds = [...new Set((prescriptions || []).map((p) => p.prescriber_id).filter(Boolean))];
    const patientIds = [...new Set((prescriptions || []).map((p) => p.patient_id).filter(Boolean))];

    const { data: providers } = prescriberIds.length
      ? await supabase
          .from("providers")
          .select("id, user_id, prefix, first_name, last_name, email, pay_on_terms, group_id, tier_level")
          .in("user_id", prescriberIds)
          .eq("pay_on_terms", true)
      : { data: [] as Array<{ id: string; user_id: string; prefix: string | null; first_name: string | null; last_name: string | null; email: string | null; pay_on_terms: boolean; group_id: string | null; tier_level: string | null }> };

    const providerByUserId = new Map((providers || []).map((p) => [p.user_id, p]));

    // Tier discount table → keyed by tier_name lowercase, value is %.
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

    // Catalog list prices for the medications referenced by these Rx
    // (needed so the accountant breakdown can show the pre-discount
    // pharmacy price next to the net price actually charged).
    const medIdsInUse = [
      ...new Set(
        (prescriptions || [])
          .map((p) => (p as { medication_id?: string | null }).medication_id)
          .filter((v): v is string => !!v),
      ),
    ];
    const { data: catalogMeds } = medIdsInUse.length
      ? await supabase
          .from("pharmacy_medications")
          .select("id, aimrx_site_pricing_cents")
          .in("id", medIdsInUse)
      : { data: [] as Array<{ id: string; aimrx_site_pricing_cents: number | null }> };
    const listCentsById = new Map(
      (catalogMeds || []).map((m) => [m.id, m.aimrx_site_pricing_cents || 0]),
    );

    const { data: patients } = patientIds.length
      ? await supabase
          .from("patients")
          .select("id, first_name, last_name, date_of_birth")
          .in("id", patientIds)
      : {
          data: [] as Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            date_of_birth: string | null;
          }>,
        };
    const patientById = new Map((patients || []).map((p) => [p.id, p]));

    // Resolve groups → group_id set that matches the on-screen group
    // and/or platform-manager filter. The UI builds the same set in
    // page.tsx (matchingGroupIds) — replicate it here so the email
    // honors the same scoping. When neither filter is set, leave the
    // set null so providers pass through unchanged.
    let allowedGroupIds: Set<string> | null = null;
    if (filters.groupId || filters.platformManagerId) {
      const { data: groupsForFilter } = await supabase
        .from("groups")
        .select("id, platform_manager_id");
      allowedGroupIds = new Set(
        (groupsForFilter || [])
          .filter((g) => {
            const okGroup = !filters.groupId || g.id === filters.groupId;
            const okPm =
              !filters.platformManagerId ||
              g.platform_manager_id === filters.platformManagerId;
            return okGroup && okPm;
          })
          .map((g) => g.id),
      );
    }

    // Pharmacy name lookup for searchTerm matching against pharmacy name.
    const pharmacyIds = [
      ...new Set((prescriptions || []).map((p) => p.pharmacy_id).filter(Boolean)),
    ] as string[];
    const { data: pharmacies } = pharmacyIds.length
      ? await supabase.from("pharmacies").select("id, name").in("id", pharmacyIds)
      : { data: [] as Array<{ id: string; name: string | null }> };
    const pharmacyNameById = new Map(
      (pharmacies || []).map((ph) => [ph.id, (ph.name || "").toLowerCase()]),
    );


    // Look up authnet flag per payment_transaction so each row can be tagged
    // "Card paid" instead of being silently dropped.
    const paymentTxnIds = [
      ...new Set((prescriptions || []).map((p) => p.payment_transaction_id).filter(Boolean)),
    ] as string[];
    let txnHasAuthnet = new Map<string, boolean>();
    if (paymentTxnIds.length > 0) {
      const { data: txns, error: txnErr } = await supabase
        .from("payment_transactions")
        .select("id, authnet_transaction_id")
        .in("id", paymentTxnIds);
      if (txnErr) {
        console.error("[pay-on-terms-email] payment_transactions fetch failed:", txnErr);
        return NextResponse.json(
          {
            error: "Failed to load payment transactions for pay-on-terms classification",
            details: txnErr.message,
          },
          { status: 500 },
        );
      }
      txnHasAuthnet = new Map(
        (txns || []).map((t) => [
          t.id,
          !!(t.authnet_transaction_id && String(t.authnet_transaction_id).trim() !== ""),
        ]),
      );
    }

    const HIDDEN_PROVIDER_LASTNAMES = ["sughayer", "providerassitant"];
    const HIDDEN_TEST_LASTNAMES = ["harton"];
    // Mirror the Pay-on-Terms tab on-screen view: when the user has
    // "Show settled" OFF (default), exclude settled + card-paid rows so
    // the email matches the default view. When the user toggles "Show
    // settled" ON before clicking Email, include those rows so the email
    // matches what they see. The goal is "print what's on the screen".
    // We also replicate ALL the on-screen filters here (search term,
    // group, platform manager, delegation, hidden test patients) so the
    // emailed list is row-for-row identical to the table on screen.
    const includeSettled = body.includeSettled === true;
    const searchLower = (filters.searchTerm || "").trim().toLowerCase();
    const rows: PotEmailRow[] = (prescriptions || [])
      .filter((rx) => {
        const prov = providerByUserId.get(rx.prescriber_id);
        if (!prov) return false;
        if (HIDDEN_PROVIDER_LASTNAMES.includes((prov.last_name || "").toLowerCase())) return false;
        if (filters.providerId && prov.id !== filters.providerId) return false;
        if (allowedGroupIds && !(prov.group_id && allowedGroupIds.has(prov.group_id))) {
          return false;
        }
        const pat = patientById.get(rx.patient_id);
        if (pat && HIDDEN_TEST_LASTNAMES.includes((pat.last_name || "").toLowerCase())) {
          return false;
        }
        if (searchLower) {
          const pharmacyName = pharmacyNameById.get(rx.pharmacy_id || "") || "";
          const provName = `${prov.first_name || ""} ${prov.last_name || ""}`.toLowerCase();
          const provEmail = (prov.email || "").toLowerCase();
          const patName = `${pat?.first_name || ""} ${pat?.last_name || ""}`.toLowerCase();
          const med = (rx.medication || "").toLowerCase();
          const matches =
            pharmacyName.includes(searchLower) ||
            provName.includes(searchLower) ||
            provEmail.includes(searchLower) ||
            patName.includes(searchLower) ||
            med.includes(searchLower);
          if (!matches) return false;
        }
        // Card-paid rows are NEVER on the Payment-on-Terms tab — the
        // on-screen API tags those orders with `payOnTerms=false` and the
        // page filters them out unconditionally. The email must do the
        // same, regardless of the "Show settled" toggle, otherwise the
        // emailed total includes card payments and diverges from screen
        // (the May 11 2026 incident: screen 47 rx / $5,522 vs email 71
        // rx / $8,280 — the $2,758 gap was all card-paid rows that
        // showed in the email but never on screen).
        const cardPaid =
          !!rx.payment_transaction_id && !!txnHasAuthnet.get(rx.payment_transaction_id);
        if (cardPaid) return false;
        // The `includeSettled` flag MIRRORS the on-screen "Show
        // settled" toggle exactly:
        //   - OFF (default, screen also OFF): drop settled rows ->
        //     outstanding-only digest.
        //   - ON (screen also ON): include BOTH outstanding AND
        //     settled rows -> the email is a screen-exact mirror.
        // Joseph's rule (May 11 2026, after the settled-only attempt
        // was rejected): "show the exact screen we have when we see it
        // on the screen on the app i want the same data that appears."
        // Card-paid was already dropped above, matching the screen
        // (which never shows card-paid because the API tags those
        // rows payOnTerms=false). So this mirror is exact.
        if (!includeSettled && rx.pay_on_terms_settled_at) return false;
        return true;
      })
      .map((rx): PotEmailRow => {
        const prov = providerByUserId.get(rx.prescriber_id)!;
        const pat = patientById.get(rx.patient_id);
        const patientPriceCents = rx.patient_price
          ? Math.round(parseFloat(rx.patient_price as unknown as string) * 100)
          : 0;
        const shippingCents = rx.shipping_fee_cents || 0;
        const providerFeeCents = (rx as { profit_cents?: number | null }).profit_cents || 0;
        const cardPaid =
          !!rx.payment_transaction_id &&
          !!txnHasAuthnet.get(rx.payment_transaction_id);
        // Accountant breakdown
        const tierName = (prov as { tier_level?: string | null }).tier_level || null;
        const tierDiscountPct = tierName
          ? tierPctByName.get(normalizeTierKey(tierName)) || 0
          : 0;
        const medIdForLookup = (rx as { medication_id?: string | null }).medication_id;
        const catalogListCents = medIdForLookup
          ? listCentsById.get(medIdForLookup) || 0
          : 0;
        // Tie-out guarantee: list - discount = net for every row.
        // 1) Catalog list present → list = catalog, discount = list - net.
        // 2) Catalog missing but tier % > 0 and net > 0 → derive list from
        //    tier % so the accountant ALWAYS sees a visible discount.
        // 3) Neither → list = net, discount = 0.
        const hasCatalogList = catalogListCents > 0;
        let listPriceCents: number;
        let tierDiscountCents: number;
        if (hasCatalogList) {
          listPriceCents = catalogListCents;
          tierDiscountCents = Math.max(0, listPriceCents - patientPriceCents);
        } else if (tierDiscountPct > 0 && patientPriceCents > 0 && tierDiscountPct < 100) {
          listPriceCents = Math.round(patientPriceCents / (1 - tierDiscountPct / 100));
          tierDiscountCents = Math.max(0, listPriceCents - patientPriceCents);
        } else {
          listPriceCents = patientPriceCents;
          tierDiscountCents = 0;
        }
        const totalChargedCents =
          patientPriceCents + providerFeeCents + shippingCents;
        return {
          rxId: rx.id,
          queueId: (rx as { queue_id?: string | null }).queue_id ?? null,
          providerId: prov.id,
          providerName:
            `${(prov as { prefix?: string | null }).prefix || "Dr."} ${prov.first_name || ""} ${prov.last_name || ""}`.trim() || "Unknown Provider",
          providerEmail: prov.email || "",
          patientFirstName: pat?.first_name ?? null,
          patientLastName: pat?.last_name ?? null,
          patientId: rx.patient_id ?? null,
          patientDob: (pat as { date_of_birth?: string | null } | undefined)?.date_of_birth ?? null,
          medication: rx.medication ?? null,
          status: rx.status ?? null,
          submittedAt: rx.submitted_at ?? null,
          settledAt: rx.pay_on_terms_settled_at ?? null,
          cardPaid,
          amountCents: patientPriceCents + shippingCents,
          listPriceCents,
          tierName,
          tierDiscountPct,
          tierDiscountCents,
          netMedCents: patientPriceCents,
          providerFeeCents,
          shippingCents,
          totalChargedCents,
        };
      });

    // Look up the schedule purely so we can render an accurate cadence line.
    const { data: schedule } = await supabase
      .from("pay_on_terms_email_schedule")
      .select("enabled, frequency, send_hour_utc")
      .eq("id", 1)
      .maybeSingle();
    const cadenceText = schedule
      ? `Sent on demand by an admin. ${describeCadence(
          schedule.frequency,
          schedule.send_hour_utc,
          schedule.enabled,
        )}`
      : "Sent on demand by an admin.";

    const filterTextParts: string[] = [];
    if (filters.pharmacyId) filterTextParts.push("filtered to one pharmacy");
    if (filters.providerId) filterTextParts.push("filtered to one provider");
    const filterText = filterTextParts.length > 0 ? filterTextParts.join(" + ") : undefined;

    const generatedAt = new Date();
    const { html, subject, totalCents, providerCount, rxCount, outstandingCents } =
      buildPayOnTermsEmail({
        rows,
        window: reportWindow,
        generatedAt,
        cadenceText,
        filterText,
      });

    if (!SENDGRID_API_KEY) {
      console.warn("[pay-on-terms-email] SendGrid not configured — skipping send");
      return NextResponse.json({
        sent: false,
        reason: "SENDGRID_API_KEY not set",
        recipients,
        providerCount,
        rxCount,
        totalCents,
        outstandingCents,
        window: { label: reportWindow.label },
      });
    }

    // Build a PDF mirror of the screen for accountant-friendly
    // attachment (Joseph: "ok a pdf is good print the screen and give
    // me an attached pdf its fine"). Wrapped in try/catch — PDF
    // failure must NEVER block the email send.
    let pdfAttachment: { content: string; filename: string; type: string; disposition: string } | null = null;
    try {
      const { buildPayOnTermsPdf } = await import("../_shared/build-pot-pdf");
      const pdf = buildPayOnTermsPdf({
        rows,
        window: reportWindow,
        generatedAt,
        totalCents,
        outstandingCents,
        settledCents: totalCents - outstandingCents,
        providerCount,
        rxCount,
      });
      pdfAttachment = {
        content: pdf.base64,
        filename: pdf.filename,
        type: "application/pdf",
        disposition: "attachment",
      };
    } catch (pdfErr) {
      console.error(
        "[pay-on-terms-email] PDF generation failed, sending HTML-only:",
        pdfErr instanceof Error ? pdfErr.message : pdfErr,
      );
    }

    try {
      await sgMail.send({
        to: recipients,
        from: { email: FROM_EMAIL, name: "AIM Rx Reports" },
        subject,
        html,
        ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
      });
      console.log(
        `[pay-on-terms-email] sent to ${recipients.join(", ")} — window=${reportWindow.shortLabel} — $${(totalCents / 100).toFixed(2)} across ${providerCount} provider(s)`,
      );
      return NextResponse.json({
        sent: true,
        recipients,
        providerCount,
        rxCount,
        totalCents,
        outstandingCents,
        prescriptionCount: rows.length,
        window: { label: reportWindow.label, shortLabel: reportWindow.shortLabel },
      });
    } catch (err) {
      console.error("[pay-on-terms-email] SendGrid error:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "Failed to send email", details: err instanceof Error ? err.message : "Unknown" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[pay-on-terms-email] Internal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
