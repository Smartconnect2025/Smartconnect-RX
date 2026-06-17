"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Pharmacy = { id: string; name: string };

type Derived = {
  newStatus: string;
  trackingNumber: string | null;
  mapped: boolean;
};

type Prescription = {
  id: string;
  queue_id: string | null;
  status: string | null;
  medication: string | null;
  payment_status: string | null;
  order_progress: string | null;
  tracking_number: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DebugResponse = {
  pharmacies?: Pharmacy[];
  pharmacyId?: string;
  pharmacyName?: string;
  rxTransactionId?: string;
  simulationMode?: boolean;
  backend?: {
    baseUrl: string;
    storeId: string | null;
    locationId: string | null;
    employeeId: string | null;
    apiKeyLength: number;
    hasSharedSecret: boolean;
  };
  call?: { ok: boolean; ms: number; error?: string; rawResponse?: string };
  parsed?: Record<string, unknown> | null;
  derived?: Derived | null;
  prescription?: Prescription | null;
  hints?: string[];
  error?: string;
};

// Plain-language label + colour for the status SmartConnect derives from PioneerRx.
const STATUS_TONE: Record<string, { label: string; tone: string }> = {
  submitted: { label: "Submitted (waiting on pharmacy)", tone: "bg-blue-100 text-blue-800" },
  packed: { label: "Packed / in pharmacist review", tone: "bg-purple-100 text-purple-800" },
  approved: { label: "Approved / verified", tone: "bg-green-100 text-green-800" },
  ready_for_pickup: { label: "Ready for pickup / shipping", tone: "bg-teal-100 text-teal-800" },
  picked_up: { label: "Picked up / in transit", tone: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "Delivered / completed", tone: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled / rejected", tone: "bg-red-100 text-red-800" },
};

function explainStatus(status?: string | null) {
  if (!status) return { label: "(none)", tone: "bg-gray-100 text-gray-700" };
  return STATUS_TONE[status] || { label: status, tone: "bg-gray-100 text-gray-800" };
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return s;
  }
}

// The PioneerRx transaction fields most useful for diagnosis, in display order.
const KEY_FIELDS: Array<{ key: string; label: string }> = [
  { key: "rxTransactionID", label: "Rx Transaction ID" },
  { key: "rxID", label: "Rx ID" },
  { key: "rxNumber", label: "Rx Number" },
  { key: "currentRxTransactionStatusText", label: "Transaction Status (text)" },
  { key: "currentRxTransactionStatusID", label: "Transaction Status (ID)" },
  { key: "currentRxStatusText", label: "Rx Status (text)" },
  { key: "currentRxStatusID", label: "Rx Status (ID)" },
  { key: "fillState", label: "Fill State" },
  { key: "completedDate", label: "Completed Date" },
  { key: "trackingNumber", label: "Tracking #" },
];

function fieldValue(parsed: Record<string, unknown>, key: string): string {
  const v =
    parsed[key] ??
    parsed[key.charAt(0).toUpperCase() + key.slice(1)] ??
    null;
  if (v == null || v === "") return "—";
  if (key.toLowerCase().includes("date")) return formatDate(String(v));
  return String(v);
}

export default function PioneerRxInspectorPage() {
  const [txId, setTxId] = useState("");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Load the PioneerRx pharmacy list on mount so the picker is ready.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/pioneerrx-debug", { credentials: "include" });
        const json = (await r.json()) as DebugResponse;
        if (Array.isArray(json.pharmacies)) {
          setPharmacies(json.pharmacies);
          if (json.pharmacies.length === 1) setPharmacyId(json.pharmacies[0].id);
        }
      } catch {
        /* picker just stays empty */
      }
    })();
  }, []);

  async function runLookup() {
    const trimmed = txId.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setShowRaw(false);
    try {
      const qs = new URLSearchParams({ rxTransactionId: trimmed });
      if (pharmacyId) qs.set("pharmacyId", pharmacyId);
      const r = await fetch(`/api/admin/pioneerrx-debug?${qs.toString()}`, {
        credentials: "include",
      });
      const json = (await r.json()) as DebugResponse;
      if (Array.isArray(json.pharmacies) && json.pharmacies.length > 0) {
        setPharmacies(json.pharmacies);
      }
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

  const call = response?.call;
  const parsed = response?.parsed ?? null;
  const derived = response?.derived ?? null;
  const rx = response?.prescription ?? null;
  const isSuccess = call?.ok && !call?.error;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PioneerRx Inspector</h1>
        <p className="text-muted-foreground mt-1">
          Look up the raw transaction PioneerRx is sending us for any Rx Transaction
          ID — and see exactly what status SmartConnect derives from it. Use this when
          a PioneerRx order looks stuck, rejected, or in an unexpected state.
        </p>
      </div>

      {response?.simulationMode && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Simulation mode is ON</div>
              <div className="text-sm text-red-800 mt-1">
                <code>PIONEERRX_SIMULATION_MODE=true</code> — responses below are{" "}
                <strong>fake</strong>, not from the real PioneerRx. Set it to{" "}
                <code>false</code> in production to talk to PioneerRx for real.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pharmacies.length > 1 && (
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                PioneerRx pharmacy
              </label>
              <select
                data-testid="select-pharmacy"
                value={pharmacyId}
                onChange={(e) => setPharmacyId(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Select a pharmacy…</option>
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runLookup();
            }}
          >
            <Input
              data-testid="input-tx-id"
              placeholder="Enter PioneerRx Rx Transaction ID (e.g. 123456)"
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              className="font-mono"
              autoFocus
            />
            <Button
              data-testid="button-check-pioneerrx"
              type="submit"
              disabled={loading || !txId.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Check PioneerRx
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            One call per click — safe to use, doesn&apos;t trigger a full cron sweep.
          </p>
          {pharmacies.length === 0 && (
            <p className="text-xs text-amber-700">
              No active PioneerRx pharmacy is configured yet. Add one under Pharmacy
              Management first.
            </p>
          )}
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

      {response && call && (
        <>
          {/* What SmartConnect concludes — the headline answer */}
          {isSuccess && derived && (
            <Card className={derived.mapped ? "border-blue-200" : "border-amber-300 bg-amber-50"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SmartConnect interpretation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {derived.mapped ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      PioneerRx status maps to:
                    </span>
                    <Badge className={explainStatus(derived.newStatus).tone}>
                      {explainStatus(derived.newStatus).label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      ({derived.newStatus})
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-amber-900">
                    <strong>Unrecognized status.</strong> PioneerRx sent a status
                    SmartConnect does not map, so an order would be left{" "}
                    <strong>unchanged</strong>. See the raw status fields below.
                  </div>
                )}
                {derived.trackingNumber && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tracking #: </span>
                    <span className="font-mono">{derived.trackingNumber}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Operator hints */}
          {response.hints && response.hints.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-900">
                  What to check
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {response.hints.map((h, i) => (
                    <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Connection */}
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Field label="Result" value={isSuccess ? "OK" : "Failed"} />
                <Field label="Response Time" value={`${call.ms ?? "—"} ms`} />
                <Field label="Pharmacy" value={response.pharmacyName || "—"} />
                <Field
                  label="Mode"
                  value={response.simulationMode ? "SIMULATED" : "Live"}
                />
              </div>
              {response.backend && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
                  <Field label="Base URL" value={response.backend.baseUrl || "—"} mono />
                  <Field label="Store ID" value={response.backend.storeId || "—"} mono />
                  <Field label="Location ID" value={response.backend.locationId || "—"} mono />
                  <Field label="Employee ID" value={response.backend.employeeId || "—"} mono />
                  <Field
                    label="API Key"
                    value={response.backend.apiKeyLength > 0 ? `${response.backend.apiKeyLength} chars` : "missing"}
                  />
                  <Field
                    label="Shared Secret"
                    value={response.backend.hasSharedSecret ? "present" : "MISSING"}
                  />
                </div>
              )}
              {call.error && (
                <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
                  <div className="font-semibold">PioneerRx error</div>
                  <div className="mt-1">{call.error}</div>
                  {call.rawResponse && (
                    <pre className="mt-2 text-xs font-mono whitespace-pre-wrap break-all">
                      {call.rawResponse}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parsed transaction fields */}
          {parsed && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PioneerRx Transaction</CardTitle>
                <p className="text-xs text-muted-foreground">
                  The fields PioneerRx returned for this transaction. SmartConnect
                  reads the status from the Transaction Status / Rx Status fields (ID
                  first, then text).
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {KEY_FIELDS.map((f) => (
                    <Field key={f.key} label={f.label} value={fieldValue(parsed, f.key)} mono />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SmartConnect's matching order */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Matching SmartConnect Order</CardTitle>
            </CardHeader>
            <CardContent>
              {rx ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <Field label="Our Status" value={rx.status || "—"} />
                  <Field label="Medication" value={rx.medication || "—"} />
                  <Field label="Queue ID" value={rx.queue_id || "—"} mono />
                  <Field label="Payment" value={rx.payment_status || "—"} />
                  <Field label="Progress" value={rx.order_progress || "—"} />
                  <Field label="Tracking #" value={rx.tracking_number || "—"} mono />
                  <Field label="Created" value={formatDate(rx.created_at)} />
                  <Field label="Updated" value={formatDate(rx.updated_at)} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No SmartConnect order is linked to this Rx Transaction ID
                  (no prescription has this <code>queue_id</code>).
                </p>
              )}
            </CardContent>
          </Card>

          {/* Raw */}
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
