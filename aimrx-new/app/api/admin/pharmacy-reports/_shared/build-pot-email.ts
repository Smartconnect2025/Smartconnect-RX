/**
 * Shared HTML builder for the Pay-on-Terms reconciliation email.
 *
 * Used by BOTH the manual send route (admin clicks "Send Now") and the
 * cron route (pg_cron-triggered scheduled send) so they always produce
 * the same content for the same data.
 *
 * Contract: this is a PERIOD-WINDOWED report — every row whose
 * `submitted_at` falls in the half-open window [window.start, window.end).
 * Each row includes its current settlement status so the recipient can
 * reconcile what was newly billed in that period.
 */

// Use the same hosted logo as every other SmartConnect RX outbound email
// (admin-alerts, mfa, cancellation, trusted-device). The previous
// Supabase storage URL pointed at a file that does not exist there,
// so the email rendered with a broken-image placeholder.
const AIM_LOGO = "https://app.smartconnects.com/logo-header.png";

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const FRIENDLY_FREQUENCY: Record<string, string> = {
  off: "(currently disabled)",
  daily: "every day",
  weekly_monday: "every Monday",
  weekly_friday: "every Friday",
  monthly_first: "the 1st of every month",
};

export function describeCadence(frequency: string, sendHourUtc: number, enabled: boolean): string {
  if (!enabled || frequency === "off")
    return "Sent on demand (auto-send schedule is currently off).";
  const when = FRIENDLY_FREQUENCY[frequency] || frequency;
  return `You receive this report ${when} at ${String(sendHourUtc).padStart(2, "0")}:00 UTC.`;
}

export interface PotEmailRow {
  rxId: string;
  /** Platform queue id (e.g. q2226003). Falls back to hashed rxId for older rows. */
  queueId: string | null;
  providerId: string;
  providerName: string;
  providerEmail: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientId: string | null;
  /** Patient date of birth, ISO string YYYY-MM-DD or full ISO. */
  patientDob: string | null;
  medication: string | null;
  status: string | null;
  submittedAt: string | null;
  /** ISO timestamp the Rx was settled (manual mark-paid), or null if still outstanding. */
  settledAt: string | null;
  /** Whether the Rx was paid by card (authnet_transaction_id present). */
  cardPaid: boolean;
  amountCents: number;
  // ── Accountant breakdown fields (May 21 2026, Joseph) ──────────
  // Every Pay-on-Terms export (HTML email, attached PDF, CSV) must
  // show the full price stack: catalog list price → tier discount
  // → net med price → provider extra fee → shipping → total. All in
  // cents. 0 is a valid value (legacy row / no catalog match).
  listPriceCents: number;
  tierName: string | null;
  tierDiscountPct: number;
  tierDiscountCents: number;
  netMedCents: number;
  providerFeeCents: number;
  shippingCents: number;
  totalChargedCents: number;
}

/** Full patient name (first + last) for the trusted-accountant view. */
function fullPatient(firstName: string | null, lastName: string | null): string {
  const name = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
  return name || "—";
}

/** DOB formatter: "May 15, 1979". Empty/invalid → "—". */
function fmtDob(iso: string | null): string {
  if (!iso) return "—";
  // YYYY-MM-DD parsed as UTC noon to avoid TZ shifting the day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Display the platform queue id when present, otherwise a short Rx hash. */
function rxRef(queueId: string | null, rxId: string): string {
  if (queueId && queueId.trim()) return queueId.trim();
  return `#${(rxId || "").slice(-8).toUpperCase()}`;
}

export interface PotEmailWindow {
  /** Inclusive start of the reporting window, as a UTC instant. */
  start: Date;
  /** Exclusive end of the reporting window, as a UTC instant. */
  end: Date;
  /** Human-readable label, e.g. "Apr 26, 2026 (US Eastern)". */
  label: string;
  /** Short token for subject line, e.g. "Apr 26" or "Apr 20 → Apr 26". */
  shortLabel: string;
}

export interface PotEmailInput {
  rows: PotEmailRow[];
  /** The reporting window covered by this email. */
  window: PotEmailWindow;
  /** When the email is being generated (used in the footer "generated at" line). */
  generatedAt: Date;
  /** One-line description of why the recipient is getting this email. */
  cadenceText: string;
  /** Optional disclaimer about an applied pharmacy/provider filter. */
  filterText?: string;
  /** Cap inline detail rows to keep the email under deliverability limits. */
  maxDetailRows?: number;
}

export interface PotEmailOutput {
  html: string;
  subject: string;
  /** Sum of bill basis for all Rx in the window (regardless of settlement). */
  totalCents: number;
  /** Sum of bill basis for Rx in the window that are still outstanding. */
  outstandingCents: number;
  /** Sum of bill basis for Rx in the window that have been settled. */
  settledCents: number;
  providerCount: number;
  rxCount: number;
  outstandingRxCount: number;
}

export function buildPayOnTermsEmail(input: PotEmailInput): PotEmailOutput {
  const { rows, window, generatedAt, cadenceText, filterText } = input;
  const maxRows = input.maxDetailRows ?? 200;

  // ---- Group by provider, sort by amount desc ----
  const byProvider = new Map<
    string,
    {
      name: string;
      email: string;
      totalCents: number;
      outstandingCents: number;
      rows: PotEmailRow[];
    }
  >();
  for (const r of rows) {
    const cur = byProvider.get(r.providerId) || {
      name: r.providerName,
      email: r.providerEmail,
      totalCents: 0,
      outstandingCents: 0,
      rows: [],
    };
    cur.totalCents += r.amountCents;
    if (!r.settledAt && !r.cardPaid) cur.outstandingCents += r.amountCents;
    cur.rows.push(r);
    byProvider.set(r.providerId, cur);
  }
  const providers = Array.from(byProvider.values()).sort(
    (a, b) => b.totalCents - a.totalCents,
  );
  for (const p of providers) {
    p.rows.sort((a, b) => {
      const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return db - da;
    });
  }

  const totalCents = providers.reduce((s, p) => s + p.totalCents, 0);
  const outstandingCents = providers.reduce((s, p) => s + p.outstandingCents, 0);
  const settledCents = totalCents - outstandingCents;
  const providerCount = providers.length;
  const rxCount = rows.length;
  const outstandingRxCount = rows.filter((r) => !r.settledAt && !r.cardPaid).length;

  // ---- Provider summary table ----
  const summaryRows = providers
    .map((p) => {
      const outstandingNote =
        p.outstandingCents > 0 && p.outstandingCents !== p.totalCents
          ? `<br/><span style="font-size:11px;color:#9CA3AF;">${fmtUsd(p.outstandingCents)} still outstanding</span>`
          : p.outstandingCents === 0 && p.totalCents > 0
            ? `<br/><span style="font-size:11px;color:#9CA3AF;">all settled / paid</span>`
            : "";
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#111827;">${escapeHtml(p.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#4B5563;">${escapeHtml(p.email)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#4B5563;text-align:right;">${p.rows.length}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;font-weight:bold;color:#047857;text-align:right;">${fmtUsd(p.totalCents)}${outstandingNote}</td>
      </tr>`;
    })
    .join("");

  // ---- Per-provider detail tables (capped at maxRows total inline) ----
  let renderedRows = 0;
  const detailBlocks: string[] = [];
  let truncatedProviders = 0;
  for (const p of providers) {
    if (renderedRows >= maxRows) {
      truncatedProviders += 1;
      continue;
    }
    const remaining = maxRows - renderedRows;
    const slice = p.rows.slice(0, remaining);
    const truncatedHere = p.rows.length - slice.length;
    renderedRows += slice.length;

    const detailRows = slice
      .map((r) => {
        let statusBadge: string;
        if (r.cardPaid) {
          statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#EFF6FF;color:#1D4ED8;font-size:10px;font-weight:600;">Card paid</span>`;
        } else if (r.settledAt) {
          statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#ECFDF5;color:#047857;font-size:10px;font-weight:600;">Settled ${escapeHtml(fmtDate(r.settledAt))}</span>`;
        } else {
          statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#FEF3C7;color:#92400E;font-size:10px;font-weight:600;">Outstanding</span>`;
        }
        const tierLabel = r.tierName
          ? `${escapeHtml(r.tierName)}${r.tierDiscountPct ? ` (${r.tierDiscountPct}%)` : ""}`
          : "—";
        return `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#6B7280;font-family:monospace;">${escapeHtml(rxRef(r.queueId, r.rxId))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#374151;">${escapeHtml(fmtDate(r.submittedAt))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#111827;">${escapeHtml(r.medication || "—")}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#4B5563;">${escapeHtml(fullPatient(r.patientFirstName, r.patientLastName))}<br/><span style="font-size:10px;color:#9CA3AF;">DOB ${escapeHtml(fmtDob(r.patientDob))}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#4B5563;text-align:right;">${fmtUsd(r.listPriceCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#4B5563;">${tierLabel}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#4B5563;text-align:right;">${fmtUsd(r.tierDiscountCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#111827;text-align:right;">${fmtUsd(r.netMedCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#4B5563;text-align:right;">${fmtUsd(r.providerFeeCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#4B5563;text-align:right;">${fmtUsd(r.shippingCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#047857;font-weight:700;text-align:right;">${fmtUsd(r.totalChargedCents)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;">${statusBadge}</td>
        </tr>`;
      })
      .join("");

    detailBlocks.push(`
      <div style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 10px;background:#EFF6FF;border:1px solid #DBEAFE;border-radius:8px 8px 0 0;border-bottom:none;">
          <div style="font-size:13px;color:#1E3A8A;font-weight:bold;">${escapeHtml(p.name)}</div>
          <div style="font-size:12px;color:#1E40AF;">${p.rows.length} Rx · <strong>${fmtUsd(p.totalCents)}</strong></div>
        </div>
        <table style="border-collapse:collapse;width:100%;border:1px solid #DBEAFE;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
          <thead><tr style="background:#F9FAFB;">
            <th style="padding:6px 8px;text-align:left;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Rx</th>
            <th style="padding:6px 8px;text-align:left;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Submitted</th>
            <th style="padding:6px 8px;text-align:left;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Medication</th>
            <th style="padding:6px 8px;text-align:left;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Patient</th>
            <th style="padding:6px 8px;text-align:right;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">List</th>
            <th style="padding:6px 8px;text-align:left;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Tier</th>
            <th style="padding:6px 8px;text-align:right;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Disc $</th>
            <th style="padding:6px 8px;text-align:right;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Net Med</th>
            <th style="padding:6px 8px;text-align:right;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Fee</th>
            <th style="padding:6px 8px;text-align:right;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Ship</th>
            <th style="padding:6px 8px;text-align:right;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Total</th>
            <th style="padding:6px 8px;text-align:left;font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Status</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
        ${
          truncatedHere > 0
            ? `<p style="font-size:11px;color:#9CA3AF;margin:6px 0 0 4px;">+ ${truncatedHere} more Rx not shown — see the dashboard for full list.</p>`
            : ""
        }
      </div>`);
  }

  const truncationFooter =
    truncatedProviders > 0
      ? `<p style="font-size:11px;color:#9CA3AF;margin:14px 0 0 0;">+ ${truncatedProviders} more provider${truncatedProviders === 1 ? "" : "s"} not shown in detail view (still counted in totals above) — see the dashboard for full list.</p>`
      : "";

  const subtitleLines = [
    `Period: ${window.label}`,
    cadenceText,
    filterText || "",
  ]
    .filter(Boolean)
    .join(" · ");

  // ---- Empty-window banner ----
  const emptyBanner =
    rxCount === 0
      ? `<div style="background:#F3F4F6;border:1px dashed #D1D5DB;border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">No pay-on-terms prescriptions in this period.</p>
          <p style="margin:6px 0 0 0;font-size:12px;color:#6B7280;">This confirmation message is sent automatically so you know the report ran successfully.</p>
        </div>`
      : "";

  // ---- Hero card ----
  // The email mirrors the on-screen Payment-on-Terms tab exactly. Hero
  // shows total billed, and the sub-meta breaks it into outstanding
  // vs. settled when there is a mix. Card-paid rows have already been
  // dropped upstream so they never affect these numbers.
  const heroCard =
    rxCount === 0
      ? ""
      : `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#065F46;">Total billed in this period</p>
          <p style="margin:4px 0 0 0;font-size:28px;font-weight:bold;color:#047857;">${fmtUsd(totalCents)}</p>
          <p style="margin:6px 0 0 0;font-size:12px;color:#065F46;">${providerCount} provider${providerCount === 1 ? "" : "s"} · ${rxCount} prescription${rxCount === 1 ? "" : "s"}${
            outstandingCents > 0 && outstandingCents !== totalCents
              ? ` · <strong>${fmtUsd(outstandingCents)}</strong> still outstanding (${fmtUsd(settledCents)} settled / paid)`
              : outstandingCents === 0
                ? ` · all settled / paid`
                : ` · all outstanding`
          }</p>
        </div>`;

  const subject = `[SmartConnect RX] Pay-on-Terms Report — ${window.shortLabel} — ${fmtUsd(totalCents)} across ${providerCount} provider${providerCount === 1 ? "" : "s"}`;

  const detailSection =
    rxCount === 0
      ? ""
      : `<h3 style="font-size:14px;color:#111827;margin:0 0 8px 0;">Summary by provider</h3>
        <table style="border-collapse:collapse;width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#F9FAFB;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Provider</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Email</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;"># Rx</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Billed</th>
          </tr></thead>
          <tbody>${summaryRows}</tbody>
        </table>

        <h3 style="font-size:14px;color:#111827;margin:24px 0 0 0;">Detail by transaction</h3>
        ${detailBlocks.join("")}
        ${truncationFooter}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;background:#ffffff;">
      <div style="background:#1E3A8A;padding:16px 24px;text-align:center;">
        <img src="${AIM_LOGO}" alt="SmartConnect RX" style="height:40px;" />
      </div>
      <div style="padding:24px;">
        <h2 style="color:#1E3A8A;margin:0 0 4px 0;font-size:20px;">Pay-on-Terms Report — ${escapeHtml(window.shortLabel)}</h2>
        <p style="color:#6B7280;margin:0 0 16px 0;font-size:12px;">${escapeHtml(subtitleLines)}</p>

        ${heroCard}
        ${emptyBanner}
        ${detailSection}

        <p style="font-size:11px;color:#9CA3AF;margin-top:24px;line-height:1.5;">
          This report covers prescriptions <strong>submitted during the period above</strong> on a pay-on-terms provider, with status submitted/billing/approved/packed/shipped/delivered.
          This email mirrors the Payment on Terms tab on screen at the moment the report was sent — same date range, same filters, same "Show settled" state. Each row is tagged Outstanding, Settled, or Card paid.
          This is a per-period reconciliation report, <strong>not</strong> a cumulative outstanding balance.<br/>
          Patient name + DOB included for accounting reconciliation — treat as PHI.<br/>
          Generated ${escapeHtml(generatedAt.toUTCString())} from <a href="https://app.smartconnects.com/admin/pharmacy-reports" style="color:#1E3A8A;">app.smartconnects.com/admin/pharmacy-reports</a> → Payment on Terms tab.
        </p>
      </div>
    </div>`;

  return {
    html,
    subject,
    totalCents,
    outstandingCents,
    settledCents,
    providerCount,
    rxCount,
    outstandingRxCount,
  };
}
