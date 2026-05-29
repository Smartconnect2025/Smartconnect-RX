"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";

import { Button } from "@/components/ui/button";
import { Loader2, Pen, Trash2, ShieldCheck } from "lucide-react";

interface PendingDelegation {
  id: string;
  status: string;
  delegate_first_name: string;
  delegate_last_name: string;
  delegate_title: string;
  scope_refills: boolean;
  scope_new_rx: boolean;
  agreement_version: number;
  agreement_text_snapshot: string;
  delegate_signed_at: string | null;
  providers: {
    id: string;
    prefix: string | null;
    first_name: string | null;
    last_name: string | null;
    npi_number: string | null;
  } | null;
}

/**
 * The text the ASSISTANT acknowledges on first login. This is intentionally
 * different from `agreement_text_snapshot` (which is the PROVIDER's
 * first-person authorization, signed by the provider when they created the
 * delegation request). Both documents must exist for legal traceability:
 * one signed by the provider granting authority, one signed by the
 * assistant accepting the conditions of acting under it.
 */
function buildAssistantAcknowledgmentText(d: PendingDelegation): string {
  const provider = d.providers;
  const providerName = provider
    ? `${provider.prefix || "Dr."} ${provider.first_name ?? ""} ${provider.last_name ?? ""}`.trim()
    : "the prescriber";
  const npi = provider?.npi_number ?? "—";
  const assistant = `${d.delegate_first_name} ${d.delegate_last_name}`.trim();
  const scope = [
    d.scope_refills && "submit prescription refills",
    d.scope_new_rx && "submit new prescriptions",
  ]
    .filter(Boolean)
    .join(" and ");

  return `PROVIDER ASSISTANCE — ASSISTANT ACKNOWLEDGMENT (v${d.agreement_version})

I, ${assistant} (${d.delegate_title}), acknowledge that I have been
authorized by ${providerName} (NPI ${npi}) to ${scope} on the AimRx platform
on ${providerName}'s behalf.

I understand and agree that:

1. ${providerName} is the legal prescriber on every prescription I submit
   under this authorization. Each prescription will be transmitted to the
   dispensing pharmacy under ${providerName}'s name and NPI (${npi}).

2. I do NOT have my own NPI for the purpose of this work and I am NOT the
   legal prescriber. I am acting solely as an authorized agent of
   ${providerName}.

3. AimRx will record my name, my role, the time of submission, and other
   audit information on every prescription I submit, and that record will
   be visible alongside ${providerName}'s name as prescriber.

4. I will not attempt to submit prescriptions outside the scope authorized
   above, and I will not act on behalf of any provider who has not
   authorized me.

5. ${providerName} or an AimRx administrator may revoke my authorization
   at any time, after which I will lose the ability to submit prescriptions
   on ${providerName}'s behalf.

6. I will treat all patient information I see while acting under this
   authorization as confidential and handle it in accordance with HIPAA.

By signing below I confirm I have read, understood, and accepted these
terms.`;
}

/**
 * Blocking acknowledgment page. Loads every pending_delegate row owned by the
 * caller; she must sign the agreement for each one before she can use the
 * portal. After all are signed, redirects to /delegate.
 */
export default function FirstLoginAcknowledgmentPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingDelegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/delegate/me", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      const rows = (json.delegations ?? []) as PendingDelegation[];
      const unsigned = rows.filter(
        (d) => d.status === "pending_delegate" && !d.delegate_signed_at,
      );
      setPending(unsigned);
      if (unsigned.length === 0) {
        // Nothing left to sign — bounce.
        router.replace("/delegate");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSigned = async () => {
    // After a signature, reload. If nothing else pending, useEffect-driven
    // load() will redirect us out.
    setActiveIdx(0);
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }
  if (pending.length === 0) return null;

  const current = pending[Math.min(activeIdx, pending.length - 1)];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <div className="text-center">
          <ShieldCheck className="w-10 h-10 text-[#1E3A8A] mx-auto" />
          <h1 className="mt-2 text-xl font-bold text-gray-900">
            Authorization acknowledgment
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Please review and sign before you can use the portal.
            {pending.length > 1 && (
              <>
                {" "}
                ({activeIdx + 1} of {pending.length})
              </>
            )}
          </p>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="font-semibold">
            Acting on behalf of {current.providers?.prefix || "Dr."} {current.providers?.first_name}{" "}
            {current.providers?.last_name}
          </div>
          <div className="mt-1">
            NPI <strong>{current.providers?.npi_number ?? "—"}</strong> · Role:{" "}
            {current.delegate_title} · Scope:{" "}
            {[current.scope_refills && "refills", current.scope_new_rx && "new prescriptions"]
              .filter(Boolean)
              .join(" + ")}
          </div>
        </div>

        <div
          className="rounded-md border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 whitespace-pre-wrap font-mono max-h-[40vh] overflow-y-auto"
          data-testid="text-assistant-acknowledgment"
        >
          {buildAssistantAcknowledgmentText(current)}
        </div>

        <SignAndSubmit delegationId={current.id} onSuccess={onSigned} />

        {pending.length > 1 && (
          <p className="text-xs text-gray-500 text-center">
            You have {pending.length} pending authorizations. After signing this
            one, the next will appear automatically.
          </p>
        )}
      </div>
    </div>
  );
}

function SignAndSubmit({
  delegationId,
  onSuccess,
}: {
  delegationId: string;
  onSuccess: () => void | Promise<void>;
}) {
  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Reset when the underlying delegation changes.
  useEffect(() => {
    sigRef.current?.clear();
    setIsEmpty(true);
    setAgreed(false);
  }, [delegationId]);

  // High-DPI canvas resize.
  useEffect(() => {
    const setup = () => {
      const canvas = sigRef.current?.getCanvas();
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
      }
      canvas.style.touchAction = "none";
    };
    const t = setTimeout(setup, 100);
    window.addEventListener("resize", setup);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", setup);
    };
  }, [delegationId]);

  const clear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
  };

  const submit = async () => {
    if (!agreed) {
      toast.error("Please confirm the acknowledgment to continue.");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("A signature is required.");
      return;
    }
    setSubmitting(true);
    try {
      const dataUrl = sigRef.current.toDataURL("image/png");
      const res = await fetch(`/api/delegate/acknowledge/${delegationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: dataUrl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success("Acknowledgment recorded.");
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <label className="flex items-start gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1"
          data-testid="checkbox-acknowledge-terms"
        />
        <span>
          I acknowledge the terms above. I understand that every prescription I
          submit will be transmitted under the provider&apos;s name and NPI, and
          that my activity will be recorded for audit.
        </span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800">Sign here</p>
          {!isEmpty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-red-600"
              data-testid="button-clear-ack-signature"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <div
          ref={containerRef}
          className="relative rounded-md border-2 border-gray-300 bg-white h-[160px]"
        >
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              className: "w-full h-full rounded-md",
              style: { cursor: "crosshair", touchAction: "none" },
            }}
            penColor="#1a1a2e"
            minWidth={1.5}
            maxWidth={3.5}
            backgroundColor="rgba(255,255,255,0)"
            onEnd={() => setIsEmpty(false)}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300">
              <Pen className="w-6 h-6 mr-2" />
              <span className="text-sm">Sign with mouse, finger, or stylus</span>
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={submit}
        disabled={submitting || isEmpty || !agreed}
        className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
        data-testid="button-submit-ack"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            Submitting…
          </>
        ) : (
          "Sign & Continue"
        )}
      </Button>
    </>
  );
}
