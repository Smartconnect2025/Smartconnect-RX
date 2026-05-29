"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

type RxEntry = {
  RxNumber?: number | string | null;
  RxDate?: string | null;
  Statuswf?: string | null;
  BillingStatus?: string | null;
  PatPay?: number | null;
  packdatetime?: string | null;
  approveddated?: string | null;
  Trackingnumber?: string | null;
  DeliveredDate?: string | null;
  PickupDate?: string | null;
  Active_Rx?: string | number | null;
  [key: string]: unknown;
};

type DebugResult = {
  queueId: string;
  httpStatus?: number;
  httpStatusText?: string;
  contentType?: string | null;
  bodyLength?: number;
  rawBody?: string;
  parsed?: RxEntry | RxEntry[] | null;
  ms?: number;
  networkError?: string;
};

type DebugResponse = {
  pharmacyId?: string;
  baseUrl?: string;
  storeId?: string;
  apiKeyLength?: number;
  count?: number;
  results?: DebugResult[];
  error?: string;
};

const STATUS_TONE: Record<string, { label: string; tone: string }> = {
  PAUSED: { label: "In Production ⭐ (compound being made)", tone: "bg-teal-100 text-teal-800" },
  "RPH REJECT": { label: "Rejected by pharmacist", tone: "bg-red-100 text-red-800" },
  "RPH REJECTED": { label: "Rejected by pharmacist", tone: "bg-red-100 text-red-800" },
  REJECTED: { label: "Rejected", tone: "bg-red-100 text-red-800" },
  TYPED: { label: "Typed (in pharmacist review)", tone: "bg-blue-100 text-blue-800" },
  PACKED: { label: "Packed", tone: "bg-purple-100 text-purple-800" },
  APPROVED: { label: "Approved", tone: "bg-green-100 text-green-800" },
  DELIVERED: { label: "Delivered", tone: "bg-green-100 text-green-800" },
  SUBMITTED: { label: "Submitted (waiting on pharmacist)", tone: "bg-blue-100 text-blue-800" },
  ACTIVE: { label: "Active", tone: "bg-blue-100 text-blue-800" },
};

function explainStatus(word?: string | null) {
  if (!word) return { label: "(no status word)", tone: "bg-gray-100 text-gray-700" };
  const key = word.toUpperCase().trim();
  return STATUS_TONE[key] || { label: word, tone: "bg-gray-100 text-gray-800" };
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return s;
  }
}

// Mirror of the backend rule in
// app/api/prescriptions/_shared/digitalrx-helpers.ts so this inspector shows the
// SAME entry the system actually uses for status. Keep in sync with
// REJECT_STATUS_WORDS / isActiveRxExplicitlyInactive / pickAuthoritativeEntry.
const REJECT_WORDS = new Set<string>([
  "rph reject", "rph rejected", "rejected", "reject",
  "cancelled", "canceled", "denied", "void", "voided",
]);

function isRejectWord(s?: string | null): boolean {
  return !!s && REJECT_WORDS.has(s.toLowerCase().trim());
}

// Backend reads the status word as Statuswf ?? Status ?? RxStatus — mirror that
// so a reject word in any of those fields is still detected.
function statusWordOf(e: RxEntry): string | null {
  const v = e.Statuswf ?? e.Status ?? e.RxStatus;
  return typeof v === "string" ? v : null;
}

function isRejectEntry(e: RxEntry): boolean {
  return isRejectWord(statusWordOf(e));
}

// Backend reads Active_Rx ?? active_rx ?? ActiveRx — mirror the alias fallback.
function isActiveRxInactive(e: RxEntry): boolean {
  const raw = e.Active_Rx ?? e.active_rx ?? e.ActiveRx;
  const s = raw == null ? "" : String(raw).trim().toLowerCase();
  return s === "0" || s === "false" || s === "no";
}

// Backend comparator (pickAuthoritativeEntry → byNewest): RxDate desc, then RxNumber desc.
function byNewestRxDate(a: RxEntry, b: RxEntry): number {
  const da = a.RxDate ? new Date(String(a.RxDate)).getTime() : 0;
  const db = b.RxDate ? new Date(String(b.RxDate)).getTime() : 0;
  if (db !== da) return db - da;
  return Number(b.RxNumber ?? 0) - Number(a.RxNumber ?? 0);
}

// EXACT mirror of backend pickAuthoritativeEntry so "CURRENT" always matches the
// entry the system actually uses for status. Returns the chosen entry object so
// the caller can locate it in any display ordering.
function pickAuthoritative(entries: RxEntry[]): RxEntry | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(byNewestRxDate);
  const realKills = sorted.filter((e) => isRejectEntry(e) && isActiveRxInactive(e));
  if (realKills.length > 0) return realKills[0];
  const aliveNonReject = sorted.filter((e) => !isRejectEntry(e));
  if (aliveNonReject.length > 0) return aliveNonReject[0];
  return sorted[0];
}

// Display-only ordering: rank by the latest real ACTION timestamp so an entry
// approved hours later sorts above a reject duplicate typed a minute after it
// (Amanda Holiday: 581517 RPH REJECT typed 10:44 vs 581511 approved 12:57).
// This is for human readability only — the CURRENT entry is chosen by
// pickAuthoritative above, not by this sort.
function lastActionTime(e: RxEntry): number {
  const candidates = [e.DeliveredDate, e.PickupDate, e.packdatetime, e.approveddated, e.RxDate];
  let max = 0;
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(String(c)).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

export default function DigitalRxInspectorPage() {
  const [queueId, setQueueId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  async function runLookup(qid: string) {
    const trimmed = qid.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setShowRaw(false);
    try {
      const r = await fetch(`/api/admin/digitalrx-debug?queueId=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
      });
      const json = (await r.json()) as DebugResponse;
      if (!r.ok) {
        setError(json.error || `Request failed: HTTP ${r.status}`);
      } else {
        setResponse(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const result = response?.results?.[0];
  const entries: RxEntry[] = !result?.parsed
    ? []
    : Array.isArray(result.parsed)
      ? result.parsed
      : [result.parsed];

  // Rank by most recent ACTION (approval/pack/pickup/delivery beats typed time),
  // so a line approved hours later outranks a reject duplicate typed a minute
  // after it. Ties fall back to the higher RxNumber.
  const sortedEntries = [...entries].sort((a, b) => {
    const diff = lastActionTime(b) - lastActionTime(a);
    if (diff !== 0) return diff;
    return Number(b.RxNumber ?? 0) - Number(a.RxNumber ?? 0);
  });

  // The entry our system actually uses for status — chosen by the EXACT backend
  // rule (pickAuthoritative), then located within the action-time display order.
  const authoritativeEntry = pickAuthoritative(entries);
  const authoritativeIndex = authoritativeEntry ? sortedEntries.indexOf(authoritativeEntry) : -1;

  const isEmptyBody = result && result.bodyLength === 0;
  const isSuccess = result && result.httpStatus === 200 && !result.networkError;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">DigitalRx Inspector</h1>
        <p className="text-muted-foreground mt-1">
          Look up the raw response DigitalRx is sending us for any queue ID.
          Use this when an order looks stuck, rejected, or in an unexpected state.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runLookup(queueId);
            }}
          >
            <Input
              data-testid="input-queue-id"
              placeholder="Enter queue ID (e.g. 2232755)"
              value={queueId}
              onChange={(e) => setQueueId(e.target.value)}
              className="font-mono"
              autoFocus
            />
            <Button data-testid="button-check-digitalrx" type="submit" disabled={loading || !queueId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Check DigitalRx
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            One call per click — safe to use, doesn&apos;t trigger a full cron sweep.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Lookup failed</div>
              <div className="text-sm text-red-800 mt-1">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {response && result && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="HTTP Status" value={`${result.httpStatus ?? "—"} ${result.httpStatusText ?? ""}`} />
              <Field label="Content-Type" value={result.contentType ?? "—"} mono />
              <Field label="Body Length" value={`${result.bodyLength ?? 0} bytes`} />
              <Field label="Response Time" value={`${result.ms ?? "—"} ms`} />
            </CardContent>
          </Card>

          {isEmptyBody && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="font-semibold text-amber-900">Empty response from DigitalRx</div>
                <p className="text-sm text-amber-800 mt-1">
                  DigitalRx returned <strong>200 OK</strong> with an empty body. This means the
                  pharmacist has not picked up the order yet, OR the queue ID has been removed
                  on their side. We leave the prescription as-is and keep retrying every 4 hours.
                </p>
              </CardContent>
            </Card>
          )}

          {sortedEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  DigitalRx Returned {sortedEntries.length}{" "}
                  {sortedEntries.length === 1 ? "Entry" : "Entries"}
                </CardTitle>
                {sortedEntries.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Sorted by most recent <strong>action</strong> (approval / pack / pickup /
                    delivery), not by typed time. The entry marked <strong>CURRENT</strong> is the
                    one our system uses for status — a line marked REJECT that is still Active is a
                    discarded duplicate, not the live order.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedEntries.map((entry, i) => {
                  const stat = explainStatus(entry.Statuswf);
                  const isAuthoritative = i === authoritativeIndex;
                  const isDiscardedDuplicate =
                    isRejectEntry(entry) && !isActiveRxInactive(entry) && !isAuthoritative;
                  return (
                    <div
                      key={i}
                      className={`border rounded-lg p-4 ${
                        isAuthoritative
                          ? "border-blue-300 bg-blue-50/40"
                          : isDiscardedDuplicate
                            ? "border-gray-200 bg-gray-50/40 opacity-70"
                            : "border-gray-200 bg-gray-50/40"
                      }`}
                      data-testid={`entry-rx-${entry.RxNumber}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAuthoritative && sortedEntries.length > 1 && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                              CURRENT
                            </Badge>
                          )}
                          {isDiscardedDuplicate && (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                              DISCARDED DUPLICATE
                            </Badge>
                          )}
                          <Badge className={stat.tone}>{stat.label}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            Statuswf: &quot;{entry.Statuswf ?? "(none)"}&quot;
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Rx #{entry.RxNumber ?? "—"}
                        </div>
                      </div>
                      {isDiscardedDuplicate && (
                        <p className="text-xs text-gray-500 -mt-1 mb-3">
                          This line is marked REJECT but is still Active — it&apos;s a duplicate copy
                          DigitalRx discarded, not a rejection of the patient&apos;s order. The
                          CURRENT entry above is the live status.
                        </p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        <Field label="Rx Date" value={formatDate(entry.RxDate)} />
                        <Field label="Approved" value={formatDate(entry.approveddated)} />
                        <Field label="Packed" value={formatDate(entry.packdatetime)} />
                        <Field label="Pickup" value={formatDate(entry.PickupDate)} />
                        <Field label="Delivered" value={formatDate(entry.DeliveredDate)} />
                        <Field label="Tracking" value={entry.Trackingnumber || "—"} mono />
                        <Field label="Billing" value={entry.BillingStatus || "—"} />
                        <Field label="Patient Pay" value={`$${(entry.PatPay ?? 0).toFixed(2)}`} />
                        <Field label="Active Rx" value={String(entry.Active_Rx ?? "—")} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowRaw(!showRaw)}>
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                {showRaw ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Raw response (for debugging)
              </CardTitle>
            </CardHeader>
            {showRaw && (
              <CardContent>
                <pre
                  data-testid="text-raw-response"
                  className="text-xs font-mono bg-gray-950 text-green-300 p-4 rounded overflow-auto max-h-96 whitespace-pre-wrap break-all"
                >
                  {JSON.stringify(response, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"} break-all`}>{value}</div>
    </div>
  );
}
