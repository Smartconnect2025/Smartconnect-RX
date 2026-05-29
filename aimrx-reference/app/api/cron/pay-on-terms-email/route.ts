/**
 * Pay-on-Terms Email — Cron Trigger
 *
 * Called by pg_cron via pg_net.http_post on a fixed schedule (every hour).
 * Reads the configured schedule from `pay_on_terms_email_schedule` and decides
 * whether NOW is the time to fire. If yes, builds the report from DB recipients
 * and sends it via SendGrid. Updates last_sent_at + last_window_end + last_status.
 *
 * Reporting model: PERIOD-WINDOWED (NOT a cumulative snapshot).
 *   - daily          → email covers yesterday (Eastern wall-clock)
 *   - weekly_monday  → email covers the previous 7 days (Mon..Sun) in Eastern
 *   - weekly_friday  → email covers the previous 7 days (Fri..Thu) in Eastern
 *   - monthly_first  → email covers the previous calendar month in Eastern
 *
 * Empty windows are still sent so the recipient knows the system is alive.
 *
 * Auth: requires header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { createAdminClient } from "@core/supabase/server";
import {
  buildPayOnTermsEmail,
  describeCadence,
  type PotEmailRow,
} from "../../admin/pharmacy-reports/_shared/build-pot-email";
import { resolveScheduledWindow } from "../../admin/pharmacy-reports/_shared/period-window";

export const dynamic = "force-dynamic";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com";
const CRON_SECRET = process.env.CRON_SECRET || "";

if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

function fmtUsd(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/**
 * Returns true if NOW (UTC) matches the configured schedule slot.
 * Slot uniqueness check is enforced separately by the atomic claim below.
 */
function inScheduleWindow(opts: {
  enabled: boolean;
  frequency: string;
  sendHourUtc: number;
  now: Date;
}): { ok: boolean; reason: string } {
  if (!opts.enabled) return { ok: false, reason: "schedule disabled" };
  if (opts.frequency === "off") return { ok: false, reason: "frequency=off" };

  const h = opts.now.getUTCHours();
  if (h !== opts.sendHourUtc) return { ok: false, reason: `hour ${h} != ${opts.sendHourUtc}` };

  const dow = opts.now.getUTCDay();
  const dom = opts.now.getUTCDate();

  if (opts.frequency === "weekly_monday" && dow !== 1)
    return { ok: false, reason: "not Monday" };
  if (opts.frequency === "weekly_friday" && dow !== 5)
    return { ok: false, reason: "not Friday" };
  if (opts.frequency === "monthly_first" && dom !== 1)
    return { ok: false, reason: "not 1st of month" };

  return { ok: true, reason: "ok" };
}

/**
 * Returns the UTC instant for the start of the current "claim slot" — the
 * configured hour at the start of today / this week / this month. Anything
 * with last_sent_at >= this moment counts as "already done for this slot".
 */
function slotStart(opts: {
  frequency: string;
  sendHourUtc: number;
  now: Date;
}): Date {
  const d = new Date(
    Date.UTC(
      opts.now.getUTCFullYear(),
      opts.now.getUTCMonth(),
      opts.now.getUTCDate(),
      opts.sendHourUtc,
      0,
      0,
      0,
    ),
  );
  if (opts.frequency === "monthly_first") {
    return new Date(
      Date.UTC(opts.now.getUTCFullYear(), opts.now.getUTCMonth(), 1, opts.sendHourUtc),
    );
  }
  return d;
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const supabase = await createAdminClient();

  const { data: schedule, error: schedErr } = await supabase
    .from("pay_on_terms_email_schedule")
    .select("enabled, frequency, send_hour_utc, last_sent_at, last_window_end")
    .eq("id", 1)
    .maybeSingle();
  if (schedErr) {
    return NextResponse.json({ error: schedErr.message }, { status: 500 });
  }
  if (!schedule) {
    return NextResponse.json({ skipped: true, reason: "no schedule row" });
  }

  const now = new Date();
  if (!force) {
    const verdict = inScheduleWindow({
      enabled: schedule.enabled,
      frequency: schedule.frequency,
      sendHourUtc: schedule.send_hour_utc,
      now,
    });
    if (!verdict.ok) return NextResponse.json({ skipped: true, reason: verdict.reason });

    // Atomic claim: only ONE concurrent invocation can move the row from
    // "not yet sent in this slot" to "claimed". Anyone else loses the race
    // and bails. We bump last_sent_at to NOW immediately so a partial failure
    // doesn't keep retrying the same slot — the next slot will pick up.
    const slotStartIso = slotStart({
      frequency: schedule.frequency,
      sendHourUtc: schedule.send_hour_utc,
      now,
    }).toISOString();

    const { data: claimed, error: claimErr } = await supabase
      .from("pay_on_terms_email_schedule")
      .update({ last_sent_at: now.toISOString(), last_status: "claimed: sending..." })
      .eq("id", 1)
      .or(`last_sent_at.is.null,last_sent_at.lt.${slotStartIso}`)
      .select("id");
    if (claimErr) {
      return NextResponse.json({ error: claimErr.message }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: "slot already claimed by another tick",
      });
    }
  }

  // ---- Resolve the reporting window for this scheduled slot ----
  const window = resolveScheduledWindow(schedule.frequency, now);

  const { data: recipientRows } = await supabase
    .from("pay_on_terms_email_recipients")
    .select("name, email, enabled")
    .eq("enabled", true);
  const recipients = (recipientRows || []).map((r) => r.email).filter(Boolean);
  if (recipients.length === 0) {
    await supabase
      .from("pay_on_terms_email_schedule")
      .update({ last_status: "skipped: no enabled recipients" })
      .eq("id", 1);
    return NextResponse.json({ skipped: true, reason: "no recipients" });
  }

  // ---- Pull all Rx submitted in this window (regardless of settlement) ----
  const { data: prescriptions, error: rxErr } = await supabase
    .from("prescriptions")
    .select(
      "id, queue_id, prescriber_id, patient_id, medication, medication_id, patient_price, shipping_fee_cents, profit_cents, submitted_at, pay_on_terms_settled_at, status, payment_transaction_id",
    )
    .gte("submitted_at", window.start.toISOString())
    .lt("submitted_at", window.end.toISOString())
    // Include `paused` (Greenwich "In Production") — see notes in the
    // manual pay-on-terms email route.
    .in("status", ["submitted", "billing", "approved", "paused", "packed", "shipped", "delivered"]);
  if (rxErr) {
    await supabase
      .from("pay_on_terms_email_schedule")
      .update({ last_status: `error: rx fetch ${rxErr.message}` })
      .eq("id", 1);
    return NextResponse.json({ error: rxErr.message }, { status: 500 });
  }

  const prescriberIds = [...new Set((prescriptions || []).map((p) => p.prescriber_id).filter(Boolean))];
  // We deliberately keep the pay_on_terms=true filter so this report stays
  // about terms-billed providers only — even if a card-paid Rx was submitted
  // by a terms provider, it'll be tagged "Card paid" rather than dropped.
  const { data: providers } = prescriberIds.length
    ? await supabase
        .from("providers")
        .select("id, user_id, prefix, first_name, last_name, email, pay_on_terms, tier_level")
        .in("user_id", prescriberIds)
        .eq("pay_on_terms", true)
    : { data: [] as Array<{ id: string; user_id: string; prefix: string | null; first_name: string | null; last_name: string | null; email: string | null; pay_on_terms: boolean; tier_level: string | null }> };
  const providerByUserId = new Map((providers || []).map((p) => [p.user_id, p]));

  // Tier discount table + catalog list prices for accountant breakdown.
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
      await supabase
        .from("pay_on_terms_email_schedule")
        .update({ last_status: `error: txn fetch ${txnErr.message}` })
        .eq("id", 1);
      return NextResponse.json({ error: txnErr.message }, { status: 500 });
    }
    txnHasAuthnet = new Map(
      (txns || []).map((t) => [
        t.id,
        !!(t.authnet_transaction_id && String(t.authnet_transaction_id).trim() !== ""),
      ]),
    );
  }

  // Patient lookup (for masked patient identifier in detail rows)
  const patientIds = [
    ...new Set((prescriptions || []).map((p) => p.patient_id).filter(Boolean)),
  ] as string[];
  const { data: patients } = patientIds.length
    ? await supabase
        .from("patients")
        .select("id, first_name, last_name, date_of_birth")
        .in("id", patientIds)
    : {
        data: [] as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          date_of_birth: string | null;
        }[],
      };
  const patientById = new Map(
    (patients || []).map((p) => [
      p.id,
      {
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
      },
    ]),
  );

  const HIDDEN = ["sughayer", "providerassitant"];
  // Mirror the Pay-on-Terms tab default in the dashboard: only outstanding
  // (unsettled, non-card-paid) rows. Card-paid and already-settled rows are
  // hidden in the UI by default, so the email must hide them too — otherwise
  // the "# Rx" and "Total billed" totals diverge from what admins see on screen.
  const rows: PotEmailRow[] = (prescriptions || [])
    .filter((rx) => {
      const prov = providerByUserId.get(rx.prescriber_id);
      if (!prov) return false;
      if (HIDDEN.includes((prov.last_name || "").toLowerCase())) return false;
      if (rx.pay_on_terms_settled_at) return false;
      const cardPaid =
        !!rx.payment_transaction_id && !!txnHasAuthnet.get(rx.payment_transaction_id);
      if (cardPaid) return false;
      return true;
    })
    .map((rx): PotEmailRow => {
      const prov = providerByUserId.get(rx.prescriber_id)!;
      const pat = patientById.get(rx.patient_id);
      const netMedCents = rx.patient_price
        ? Math.round(parseFloat(rx.patient_price as unknown as string) * 100)
        : 0;
      const shippingCents = rx.shipping_fee_cents || 0;
      const providerFeeCents = (rx as { profit_cents?: number | null }).profit_cents || 0;
      const cardPaid =
        !!rx.payment_transaction_id &&
        !!txnHasAuthnet.get(rx.payment_transaction_id);
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
        tierDiscountCents = Math.max(0, listPriceCents - netMedCents);
      } else if (tierDiscountPct > 0 && netMedCents > 0 && tierDiscountPct < 100) {
        listPriceCents = Math.round(netMedCents / (1 - tierDiscountPct / 100));
        tierDiscountCents = Math.max(0, listPriceCents - netMedCents);
      } else {
        listPriceCents = netMedCents;
        tierDiscountCents = 0;
      }
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
        amountCents: netMedCents + shippingCents,
        listPriceCents,
        tierName,
        tierDiscountPct,
        tierDiscountCents,
        netMedCents,
        providerFeeCents,
        shippingCents,
        totalChargedCents: netMedCents + providerFeeCents + shippingCents,
      };
    });

  const cadenceText = describeCadence(
    schedule.frequency,
    schedule.send_hour_utc,
    schedule.enabled,
  );
  const { html, subject, totalCents, providerCount, rxCount, outstandingCents } =
    buildPayOnTermsEmail({
      rows,
      window,
      generatedAt: now,
      cadenceText,
    });

  if (!SENDGRID_API_KEY) {
    await supabase
      .from("pay_on_terms_email_schedule")
      .update({ last_status: "skipped: SENDGRID_API_KEY not set" })
      .eq("id", 1);
    return NextResponse.json({ skipped: true, reason: "SENDGRID_API_KEY not set" });
  }

  try {
    await sgMail.send({
      to: recipients,
      from: { email: FROM_EMAIL, name: "AIM Rx Reports" },
      subject,
      html,
    });
    await supabase
      .from("pay_on_terms_email_schedule")
      .update({
        last_sent_at: now.toISOString(),
        last_window_end: window.end.toISOString(),
        last_status:
          rxCount === 0
            ? `sent (empty): ${recipients.length}rcpt, ${window.shortLabel}`
            : `sent: ${recipients.length}rcpt, ${window.shortLabel}, ${fmtUsd(totalCents)} (${fmtUsd(outstandingCents)} outstanding)`,
      })
      .eq("id", 1);
    return NextResponse.json({
      sent: true,
      recipients,
      providerCount,
      rxCount,
      totalCents,
      outstandingCents,
      window: {
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        label: window.label,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    await supabase
      .from("pay_on_terms_email_schedule")
      .update({ last_status: `error: SendGrid ${msg}` })
      .eq("id", 1);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
