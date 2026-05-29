/**
 * Pay-on-Terms PDF builder.
 *
 * Produces a screen-exact tabular PDF of the Payment-on-Terms tab for
 * attachment to the on-demand email. Same row set as the HTML body
 * (card-paid already filtered upstream, settled rows included or
 * excluded per the admin's "Show settled" toggle).
 *
 * Uses jspdf + jspdf-autotable (already in the project for the
 * Greenwich Electronic Rx renderer). Returns a base64 string and a
 * filename ready to drop into a SendGrid attachments array.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PotEmailRow, PotEmailWindow } from "./build-pot-email";

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fullPatient(firstName: string | null, lastName: string | null): string {
  const name = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
  return name || "—";
}

function fmtDob(iso: string | null): string {
  if (!iso) return "—";
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

function rxRef(queueId: string | null, rxId: string): string {
  if (queueId && queueId.trim()) return queueId.trim();
  return `#${(rxId || "").slice(-8).toUpperCase()}`;
}

export interface PotPdfInput {
  rows: PotEmailRow[];
  window: PotEmailWindow;
  generatedAt: Date;
  totalCents: number;
  outstandingCents: number;
  settledCents: number;
  providerCount: number;
  rxCount: number;
}

export interface PotPdfOutput {
  filename: string;
  base64: string;
}

export function buildPayOnTermsPdf(input: PotPdfInput): PotPdfOutput {
  const {
    rows,
    window: reportWindow,
    generatedAt,
    totalCents,
    outstandingCents,
    settledCents,
    providerCount,
    rxCount,
  } = input;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SmartConnect RX — Pay-on-Terms Report", margin, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${reportWindow.label}`, margin, 68);
  doc.text(
    `Generated: ${generatedAt.toUTCString()}`,
    pageWidth - margin,
    68,
    { align: "right" },
  );

  // Hero
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total billed: ${fmtUsd(totalCents)}  ·  ${providerCount} provider${providerCount === 1 ? "" : "s"}  ·  ${rxCount} Rx`,
    margin,
    92,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const heroLine2 =
    outstandingCents > 0 && outstandingCents !== totalCents
      ? `${fmtUsd(outstandingCents)} still outstanding  ·  ${fmtUsd(settledCents)} settled / paid`
      : outstandingCents === 0
        ? `All settled / paid`
        : `All outstanding`;
  doc.text(heroLine2, margin, 108);

  // Group by provider, mirror the HTML email layout
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

  // Summary table
  let cursorY = 128;
  autoTable(doc, {
    startY: cursorY,
    head: [["Provider", "Email", "# Rx", "Billed", "Outstanding"]],
    body: providers.map((p) => [
      p.name,
      p.email,
      String(p.rows.length),
      fmtUsd(p.totalCents),
      p.outstandingCents > 0 ? fmtUsd(p.outstandingCents) : "—",
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // Detail per provider
  for (const p of providers) {
    const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY ?? cursorY;
    cursorY = lastY + 18;

    if (cursorY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      cursorY = 50;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${p.name}  —  ${p.rows.length} Rx  ·  ${fmtUsd(p.totalCents)}`,
      margin,
      cursorY,
    );
    cursorY += 6;

    autoTable(doc, {
      startY: cursorY,
      head: [[
        "Queue",
        "Submitted",
        "Medication",
        "Patient",
        "DOB",
        "List",
        "Tier",
        "Disc %",
        "Disc $",
        "Net Med",
        "Fee",
        "Ship",
        "Total",
        "Status",
      ]],
      body: p.rows.map((r) => {
        const status = r.cardPaid
          ? "Card paid"
          : r.settledAt
            ? `Settled ${fmtDate(r.settledAt)}`
            : "Outstanding";
        return [
          rxRef(r.queueId, r.rxId),
          fmtDate(r.submittedAt),
          r.medication || "—",
          fullPatient(r.patientFirstName, r.patientLastName),
          fmtDob(r.patientDob),
          fmtUsd(r.listPriceCents),
          r.tierName || "—",
          r.tierDiscountPct ? `${r.tierDiscountPct}%` : "—",
          fmtUsd(r.tierDiscountCents),
          fmtUsd(r.netMedCents),
          fmtUsd(r.providerFeeCents),
          fmtUsd(r.shippingCents),
          fmtUsd(r.totalChargedCents),
          status,
        ];
      }),
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [243, 244, 246], textColor: 17, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        5: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
        11: { halign: "right" },
        12: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });
  }

  // Footer note on the last page
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    cursorY;
  let footerY = finalY + 18;
  if (footerY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    footerY = 50;
  }
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text(
    "Mirrors the on-screen Payment-on-Terms tab exactly — same date range, same filters, same Show-Settled state. Patient name + DOB included for accounting reconciliation — treat as PHI.",
    margin,
    footerY,
    { maxWidth: pageWidth - margin * 2 },
  );

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 18,
      { align: "right" },
    );
  }

  const arrBuf = doc.output("arraybuffer");
  const base64 = Buffer.from(arrBuf).toString("base64");
  const filename = `smartconnect-pot-${reportWindow.shortLabel.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
  return { filename, base64 };
}
