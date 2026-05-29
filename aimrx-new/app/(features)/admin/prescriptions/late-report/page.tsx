"use client";

import { useEffect, useState } from "react";
import { Flag, Printer, Loader2 } from "lucide-react";

const LATE_THRESHOLD_HOURS = 72;
const TERMINAL_STATUSES = ["shipped", "delivered", "cancelled", "picked_up", "rejected"];

interface RxRow {
  id: string;
  queueId: string | null;
  patientName: string;
  providerName: string;
  medication: string;
  dosage?: string;
  strength?: string;
  sig: string;
  quantity: number | string;
  refills: number | string;
  status: string;
  pharmacyName?: string;
  submittedAt?: string;
  sentToPharmacyAt?: string | null;
  statusUpdatedAt?: string;
  trackingNumber?: string | null;
}

const fmtDateTimeET = (iso?: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const fmtHrsCompact = (h: number) => {
  if (h <= 0) return "—";
  const d = Math.floor(h / 24);
  const r = h % 24;
  if (d >= 1) return `${d}d ${r}h`;
  return `${h}h`;
};

// Fall back to submittedAt when sent_to_pharmacy_at is not exposed (SmartConnect
// admin API does not currently return that column).
const referenceTs = (rx: RxRow): string | null =>
  rx.sentToPharmacyAt || rx.submittedAt || null;

const isLate = (rx: RxRow): { late: boolean; hrsAtPharm: number; hrsSilent: number } => {
  const ref = referenceTs(rx);
  if (!ref) return { late: false, hrsAtPharm: 0, hrsSilent: 0 };
  if (TERMINAL_STATUSES.includes((rx.status || "").toLowerCase())) {
    return { late: false, hrsAtPharm: 0, hrsSilent: 0 };
  }
  const hrsAtPharm = Math.round((Date.now() - new Date(ref).getTime()) / 3600000);
  const hrsSilent = rx.statusUpdatedAt
    ? Math.round((Date.now() - new Date(rx.statusUpdatedAt).getTime()) / 3600000)
    : hrsAtPharm;
  return { late: hrsAtPharm >= LATE_THRESHOLD_HOURS, hrsAtPharm, hrsSilent };
};

export default function LateOrdersPrintReport() {
  const [rows, setRows] = useState<RxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Multi-pharmacy: hit the admin endpoint without a pharmacyId filter so
        // super-admins see late orders across every pharmacy. Pharmacy-scoped
        // admins are already constrained server-side.
        const r = await fetch("/api/admin/prescriptions", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const list: RxRow[] = Array.isArray(data) ? data : data.prescriptions || [];
        const lateList = list
          .filter((rx) => isLate(rx).late)
          .sort(
            (a, b) =>
              new Date(referenceTs(a) || 0).getTime() -
              new Date(referenceTs(b) || 0).getTime(),
          );
        setRows(lateList);
      } catch (e: any) {
        setError(e?.message || "Failed to load late orders");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const pharmacyGroups = new Map<string, RxRow[]>();
  rows.forEach((r) => {
    const ph = r.pharmacyName || "Unknown Pharmacy";
    if (!pharmacyGroups.has(ph)) pharmacyGroups.set(ph, []);
    pharmacyGroups.get(ph)!.push(r);
  });
  const pharmacyList = Array.from(pharmacyGroups.entries());

  return (
    <>
      <style>{`
        @page { size: letter landscape; margin: 0.4in; }
        body { background: #f5f5f5; }
        .print-page { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; max-width: 1180px; margin: 24px auto; padding: 24px; background: white; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 6px; font-size: 11px; line-height: 1.35; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; max-width: 1180px; margin: 16px auto 0; padding: 0 24px; }
        .toolbar h2 { margin: 0; font-size: 14px; color: #555; }
        .print-btn { display: inline-flex; align-items: center; gap: 6px; background: #1E3A8A; color: white; padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .print-btn:hover { background: #1E40AF; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1E3A8A; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { margin: 0; font-size: 22px; color: #1E3A8A; letter-spacing: -0.3px; }
        .header .meta { font-size: 10px; color: #555; text-align: right; }
        .header .meta .gen { font-weight: 600; color: #111; }
        .summary { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
        .summary h2 { margin: 0 0 4px 0; font-size: 13px; color: #991B1B; display: flex; align-items: center; gap: 6px; }
        .summary p { margin: 2px 0; font-size: 10.5px; color: #7F1D1D; }
        .summary .rule { font-size: 9.5px; color: #991B1B; font-style: italic; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #FCA5A5; }
        .pharmacy-section { margin-bottom: 18px; page-break-inside: auto; }
        .pharmacy-section h3 { margin: 0 0 6px 0; font-size: 12px; background: #1E3A8A; color: white; padding: 5px 10px; border-radius: 4px 4px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        thead { background: #475569; color: white; }
        th { padding: 6px 5px; text-align: left; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; border-right: 1px solid #64748B; }
        th:last-child { border-right: none; }
        td { padding: 7px 5px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
        tr:nth-child(even) td { background: #F9FAFB; }
        .ref { font-family: "SF Mono", "Courier New", monospace; font-weight: 600; color: #1E3A8A; white-space: nowrap; }
        .queue { font-family: "SF Mono", "Courier New", monospace; font-weight: 600; }
        .patient { font-weight: 600; }
        .med { font-weight: 500; }
        .med small { font-weight: 400; color: #666; display: block; font-size: 9px; }
        .sig { color: #444; font-size: 9.5px; max-width: 200px; }
        .status { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; text-transform: uppercase; background: #DBEAFE; color: #1E40AF; }
        .stuck { font-weight: 700; color: #B91C1C; white-space: nowrap; }
        .stuck small { display: block; font-weight: 400; color: #7F1D1D; font-size: 8.5px; }
        .ts { font-size: 9.5px; white-space: nowrap; }
        .ts small { display: block; color: #888; font-size: 8.5px; }
        .late-pill { display: inline-block; background: #DC2626; color: white; padding: 1px 5px; border-radius: 3px; font-size: 8.5px; font-weight: 700; letter-spacing: 0.4px; margin-bottom: 2px; }
        .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
        .empty-state { text-align: center; padding: 40px; color: #6B7280; }
        @media print {
          body { background: white !important; }
          .toolbar { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="toolbar">
        <h2>Late Orders Report — Print Preview</h2>
        <button className="print-btn" onClick={() => window.print()} data-testid="button-print-report">
          <Printer style={{ width: 16, height: 16 }} /> Print / Save as PDF
        </button>
      </div>

      <div className="print-page">
        <div className="header">
          <div>
            <h1>Late Orders Report</h1>
            <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>
              {pharmacyList.length === 1 ? (
                <>
                  Pharmacy: <b>{pharmacyList[0][0]}</b> &nbsp;·&nbsp; {rows.length} orders flagged
                </>
              ) : (
                <>
                  {pharmacyList.length} pharmacies &nbsp;·&nbsp; {rows.length} orders flagged
                </>
              )}
            </div>
          </div>
          <div className="meta">
            <div className="gen">Generated {today}</div>
            <div>admin / prescriptions</div>
          </div>
        </div>

        <div className="summary">
          <h2>
            <Flag style={{ width: 14, height: 14 }} /> {rows.length} late orders flagged
          </h2>
          <p>
            All orders below were <b>submitted to the pharmacy</b> but have not yet shipped, been picked up, or marked delivered after more than {LATE_THRESHOLD_HOURS} hours.
          </p>
          <div className="rule">
            <b>Late rule:</b> sent to pharmacy &gt; {LATE_THRESHOLD_HOURS}h ago + status not in (shipped / delivered / picked up / cancelled / rejected)
          </div>
        </div>

        {loading && (
          <div className="empty-state">
            <Loader2 style={{ display: "inline-block", animation: "spin 1s linear infinite", width: 24, height: 24 }} />
            <p>Loading current late orders…</p>
          </div>
        )}

        {error && (
          <div className="empty-state" style={{ color: "#DC2626" }}>
            <p>
              <b>Failed to load:</b> {error}
            </p>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="empty-state">
            <p style={{ fontSize: 14, color: "#059669" }}>
              <b>✓ Great news — no late orders right now.</b>
            </p>
            <p>
              Every submitted order is within the {LATE_THRESHOLD_HOURS}-hour pharmacy turnaround window, or has already shipped.
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          pharmacyList.map(([phName, phRows]) => (
            <div className="pharmacy-section" key={phName}>
              {pharmacyList.length > 1 && (
                <h3>
                  {phName} — {phRows.length} order{phRows.length === 1 ? "" : "s"}
                </h3>
              )}
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 75 }}>Ref</th>
                    <th style={{ width: 65 }}>Queue</th>
                    <th style={{ width: 100 }}>Patient</th>
                    <th style={{ width: 120 }}>Prescriber</th>
                    <th>Medication / Dosage</th>
                    <th>SIG (Directions)</th>
                    <th style={{ width: 36 }}>Qty</th>
                    <th style={{ width: 60 }}>Status</th>
                    <th style={{ width: 88 }}>Paid &amp; Sent</th>
                    <th style={{ width: 85 }}>Last Update</th>
                    <th style={{ width: 75 }}>Stuck</th>
                  </tr>
                </thead>
                <tbody>
                  {phRows.map((r) => {
                    const { hrsAtPharm, hrsSilent } = isLate(r);
                    return (
                      <tr key={r.id}>
                        <td className="ref">#{r.id.slice(-8).toUpperCase()}</td>
                        <td className="queue">{r.queueId && r.queueId !== "N/A" ? r.queueId : "—"}</td>
                        <td className="patient">{r.patientName}</td>
                        <td>{r.providerName}</td>
                        <td className="med">
                          {r.medication}
                          {(r.dosage || r.strength) && <small>{r.dosage || r.strength}</small>}
                        </td>
                        <td className="sig">{r.sig}</td>
                        <td>{r.quantity}</td>
                        <td>
                          <span className="status">{r.status}</span>
                        </td>
                        <td className="ts">
                          {fmtDateTimeET(referenceTs(r))}
                          <small>ET</small>
                        </td>
                        <td className="ts">
                          {fmtDateTimeET(r.statusUpdatedAt || r.submittedAt)}
                          <small>ET</small>
                        </td>
                        <td className="stuck">
                          <span className="late-pill">LATE</span>
                          <br />
                          {fmtHrsCompact(hrsAtPharm)}
                          <small>silent {fmtHrsCompact(hrsSilent)}</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        <div className="footer">
          <div>Confidential — share only with authorized pharmacy &amp; admin staff</div>
          <div>Generated {today}</div>
        </div>
      </div>
    </>
  );
}
