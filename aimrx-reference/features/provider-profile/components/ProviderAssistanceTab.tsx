"use client";

import { useCallback, useEffect, useState } from "react"; // useEffect used by tier-row prop sync
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ShieldOff,
  RefreshCw,
  AlertCircle,
  Percent,
  Save,
  Receipt,
  Pencil,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { ProviderTabsNavigation } from "./ProviderTabsNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DelegationStatus =
  | "pending_admin"
  | "pending_delegate"
  | "active"
  | "rejected"
  | "revoked";

interface DelegationRow {
  id: string;
  delegate_first_name: string;
  delegate_last_name: string;
  delegate_email: string;
  delegate_phone: string | null;
  delegate_title: string;
  delegate_user_id?: string | null;
  scope_refills: boolean;
  scope_new_rx: boolean;
  status: DelegationStatus;
  created_at: string;
  admin_action_at: string | null;
  admin_rejection_reason: string | null;
  delegate_signed_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  // The assistant's own providers row (provisioned at admin approval).
  // `tier_code` is the per-assistant tier override pinned on her own row;
  // when null she falls back to this provider's tier at checkout.
  assistant_provider?: {
    id: string;
    tier_code: string | null;
    tier_name: string | null;
    discount_percentage: number | null;
    // Per-assistant billed-on-terms toggle. When true, every
    // prescription she submits bypasses the patient payment flow
    // (auto-paid, no patient receipt). Edited via the
    // ProviderAssignPayOnTermsRow on each card.
    pay_on_terms: boolean;
  } | null;
}

interface Tier {
  tier_code: string;
  tier_name: string;
  discount_percentage: number | string;
  description?: string | null;
}

interface ProviderInfo {
  id: string;
  npi_number: string | null;
  prefix?: string | null;
  first_name: string | null;
  last_name: string | null;
  has_signature: boolean;
  is_active: boolean;
}

const STATUS_LABELS: Record<DelegationStatus, { label: string; color: string }> = {
  pending_admin: { label: "Awaiting admin approval", color: "bg-amber-100 text-amber-900" },
  pending_delegate: { label: "Awaiting assistant signature", color: "bg-blue-100 text-blue-900" },
  active: { label: "Active", color: "bg-green-100 text-green-900" },
  rejected: { label: "Rejected by admin", color: "bg-red-100 text-red-900" },
  revoked: { label: "Revoked", color: "bg-gray-200 text-gray-700" },
};

export function ProviderAssistanceTab() {
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DelegationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DelegationRow | null>(null);
  const [editTarget, setEditTarget] = useState<DelegationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Pricing-tier and pay-on-terms controls for an assistant are
      // intentionally NOT exposed on the supervising provider's view —
      // they are admin / super-admin controls only. So this page no longer
      // needs to fetch the tier catalog; it only renders the delegation
      // list (request, status, revoke).
      const delegRes = await fetch("/api/provider/delegations", {
        cache: "no-store",
      });
      const json = await delegRes.json();
      if (!delegRes.ok) {
        throw new Error(json?.error ?? `Failed (${delegRes.status})`);
      }
      setDelegations(json.delegations ?? []);
      setProvider(json.provider ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ProviderTabsNavigation />
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Provider Assistance</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Authorize an assistant (nurse, MA, office manager) to submit
              prescriptions on your behalf, under your NPI. You remain the legal
              prescriber on every order. Revoke any time, no notice required.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              data-testid="button-refresh-delegations"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setOpenForm(true)}
              disabled={!provider?.is_active || !provider?.has_signature || !provider?.npi_number}
              data-testid="button-request-assistant"
            >
              <Plus className="w-4 h-4 mr-1" />
              Request New Assistant
            </Button>
          </div>
        </header>

        {provider && (!provider.has_signature || !provider.npi_number || !provider.is_active) && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">You can&apos;t request an assistant yet.</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {!provider.is_active && (
                  <li>Your provider account is not active. Complete verification first.</li>
                )}
                {!provider.npi_number && (
                  <li>Add your NPI on the Profile tab.</li>
                )}
                {!provider.has_signature && (
                  <li>Add your signature on the Profile tab — it will be captured at the time of authorization.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : delegations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-700 font-medium">No assistants authorized yet.</p>
            <p className="text-sm text-gray-500 mt-1">
              Click &ldquo;Request New Assistant&rdquo; to start.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="list-delegations">
            {delegations.map((d) => (
              <DelegationCard
                key={d.id}
                d={d}
                onRevoke={() => setRevokeTarget(d)}
                onEdit={() => setEditTarget(d)}
                onDelete={() => setDeleteTarget(d)}
              />
            ))}
          </ul>
        )}
      </div>

      {provider && (
        <RequestForm
          open={openForm || !!editTarget}
          onOpenChange={(o) => {
            if (!o) {
              setOpenForm(false);
              setEditTarget(null);
            } else {
              setOpenForm(true);
            }
          }}
          provider={provider}
          editTarget={editTarget}
          onSuccess={load}
        />
      )}

      <RevokeDialog
        target={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onSuccess={load}
      />

      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={load}
      />
    </div>
  );
}

function DelegationCard({
  d,
  onRevoke,
  onEdit,
  onDelete,
}: {
  d: DelegationRow;
  onRevoke: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_LABELS[d.status];
  const canRevoke = d.status === "active" || d.status === "pending_delegate";
  // While the request is still waiting on admin approval, the supervising
  // provider can edit the form (delete + re-create with corrected values)
  // or delete the pending request entirely — no admin involvement needed.
  const canEditOrDelete = d.status === "pending_admin";
  return (
    <li
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid={`row-delegation-${d.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900" data-testid={`text-delegate-name-${d.id}`}>
              {d.delegate_first_name} {d.delegate_last_name}
            </span>
            <span className="text-sm text-gray-500">·</span>
            <span className="text-sm text-gray-700">{d.delegate_title}</span>
            <Badge className={status.color} data-testid={`badge-status-${d.id}`}>
              {status.label}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>{d.delegate_email}</span>
            {d.delegate_phone && <span>{d.delegate_phone}</span>}
            <span>
              Scope:{" "}
              {[d.scope_refills && "refills", d.scope_new_rx && "new prescriptions"]
                .filter(Boolean)
                .join(" + ")}
            </span>
            <span>Requested {new Date(d.created_at).toLocaleDateString()}</span>
          </div>
          {d.status === "rejected" && d.admin_rejection_reason && (
            <p className="mt-2 text-sm text-red-700">
              <span className="font-medium">Reason:</span> {d.admin_rejection_reason}
            </p>
          )}
          {d.status === "revoked" && d.revoke_reason && (
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Revoke reason:</span> {d.revoke_reason}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {canEditOrDelete && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="text-gray-700 border-gray-200 hover:bg-gray-50"
                data-testid={`button-edit-${d.id}`}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-red-700 border-red-200 hover:bg-red-50"
                data-testid={`button-delete-${d.id}`}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </>
          )}
          {canRevoke && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRevoke}
              className="text-red-700 border-red-200 hover:bg-red-50"
              data-testid={`button-revoke-${d.id}`}
            >
              <ShieldOff className="w-4 h-4 mr-1" />
              Revoke
            </Button>
          )}
        </div>
      </div>

    </li>
  );
}

// NOTE: ProviderAssignTierRow + ProviderAssignPayOnTermsRow used to be
// rendered here so a supervising provider could pin a pricing tier or
// toggle "pay on terms" on her own assistant. Those controls were moved
// to admin / super-admin only — the provider should never be able to
// grant herself discounts or deferred payment terms. The corresponding
// admin UI lives at app/(features)/admin/provider-assistance/page.tsx
// (AssignTierRow + AssignPayOnTermsRow). The two component definitions
// below are kept for now as dead code in case admin reuse becomes useful,
// but they are no longer rendered or imported anywhere on the
// provider-facing surface.

/**
 * Per-assistant "Mark orders Paid on Terms" toggle —
 * supervising-provider variant.
 *
 * Mirrors the admin `AssignPayOnTermsRow` on the Provider Assistance
 * admin page. The supervising provider can toggle whether her
 * assistant's prescriptions bypass the patient payment flow entirely.
 * When ON: every order she submits is auto-marked paid and shipped to
 * the pharmacy — no patient receipts, no payment links, no billing
 * emails/SMS to the patient. Use for assistants of providers billed on
 * terms (one card on file, monthly invoice, etc.).
 */
function ProviderAssignPayOnTermsRow({
  delegation,
  onSaved,
}: {
  delegation: DelegationRow;
  onSaved: () => void;
}) {
  const initial = delegation.assistant_provider?.pay_on_terms === true;
  const [enabled, setEnabled] = useState<boolean>(initial);
  const [saving, setSaving] = useState(false);

  // Resync when parent reloads.
  useEffect(() => {
    setEnabled(delegation.assistant_provider?.pay_on_terms === true);
  }, [delegation.assistant_provider?.pay_on_terms]);

  const dirty = enabled !== initial;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/provider/delegations/${delegation.id}/pay-on-terms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payOnTerms: enabled }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(
        enabled
          ? "Billed on terms enabled for this assistant."
          : "Billed on terms disabled for this assistant.",
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setEnabled(initial);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Receipt className="w-4 h-4 text-amber-700" />
        <div className="text-sm font-semibold text-amber-900">
          Mark orders Paid on Terms
        </div>
        <Badge
          variant="outline"
          className={
            initial
              ? "bg-white border-amber-400 text-amber-900"
              : "bg-white border-gray-300 text-gray-700"
          }
          data-testid={`badge-pay-on-terms-${delegation.id}`}
        >
          {initial ? "On" : "Off"}
        </Badge>
      </div>
      <p className="text-xs text-amber-900/80 mb-2">
        When enabled, this assistant&apos;s orders bypass the patient
        payment flow entirely — they are automatically marked as paid
        and submitted straight to the pharmacy.{" "}
        <strong>No payment receipts, payment links, or billing
        emails/SMS are sent to the patient.</strong>{" "}
        Use only for accounts billed on terms (one card on file, monthly
        invoice, etc.).
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-amber-900">
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={saving}
            data-testid={`switch-pay-on-terms-${delegation.id}`}
          />
          {enabled ? "Bypass patient payment" : "Normal patient payment"}
        </label>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !dirty}
          data-testid={`button-save-pay-on-terms-${delegation.id}`}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Per-assistant pricing tier picker — supervising-provider variant.
 *
 * Mirrors the admin `AssignTierRow` on the Provider Assistance admin page.
 * The supervising provider can pin a specific tier on her assistant's
 * providers row; when set, the patient is charged at that tier on every
 * prescription the assistant submits. When cleared (Unassigned), the
 * assistant falls back to this provider's own tier — same behavior as
 * before this feature shipped, so existing assistants are unaffected.
 */
function ProviderAssignTierRow({
  delegation,
  tiers,
  onSaved,
}: {
  delegation: DelegationRow;
  tiers: Tier[];
  onSaved: () => void;
}) {
  const initial = delegation.assistant_provider?.tier_code ?? "";
  const [value, setValue] = useState<string>(initial);
  const [saving, setSaving] = useState(false);

  // Resync local selection whenever the parent reloads delegations and
  // hands us a new tier_code. Without this, after Save the dropdown would
  // appear "dirty" again on the next refresh because `initial` changed
  // but the controlled `value` did not.
  useEffect(() => {
    setValue(delegation.assistant_provider?.tier_code ?? "");
  }, [delegation.assistant_provider?.tier_code]);

  const dirty = (value || "") !== (initial || "");
  const NONE = "__none__";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/provider/delegations/${delegation.id}/tier`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierCode: value || null }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(
        value
          ? `Tier ${value} set for this assistant.`
          : "Tier override cleared. Assistant will use your tier.",
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-emerald-50/50 border border-emerald-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Percent className="w-4 h-4 text-emerald-700" />
        <div className="text-sm font-semibold text-emerald-900">
          Pricing Tier for this Assistant
        </div>
        {delegation.assistant_provider?.tier_code ? (
          <Badge
            variant="outline"
            className="bg-white border-emerald-300 text-emerald-900"
            data-testid={`badge-current-tier-${delegation.id}`}
          >
            {delegation.assistant_provider.tier_code}
            {delegation.assistant_provider.discount_percentage != null
              ? ` · ${delegation.assistant_provider.discount_percentage}%`
              : ""}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-white border-gray-300 text-gray-700"
            data-testid={`badge-current-tier-${delegation.id}`}
          >
            Uses your tier
          </Badge>
        )}
      </div>
      <p className="text-xs text-emerald-900/80 mb-2">
        Pin a specific pricing tier for this assistant. Patients she serves
        will be charged at that tier on every prescription. Leave as
        &ldquo;Use my tier&rdquo; to keep her on the same tier as you.
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={value || NONE}
          onValueChange={(v) => setValue(v === NONE ? "" : v)}
        >
          <SelectTrigger
            className="bg-white"
            data-testid={`select-tier-${delegation.id}`}
          >
            <SelectValue placeholder="Use my tier (default)" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value={NONE} className="py-2 text-sm">
              <span className="text-gray-500">— Use my tier (default) —</span>
            </SelectItem>
            {tiers.length === 0 ? (
              <SelectItem value="no-tiers" disabled>
                No tiers defined yet
              </SelectItem>
            ) : (
              tiers.map((t) => (
                <SelectItem
                  key={t.tier_code}
                  value={t.tier_code}
                  className="py-2 text-sm cursor-pointer"
                  data-testid={`select-option-tier-${delegation.id}-${t.tier_code}`}
                >
                  {t.tier_code} · {t.tier_name} · {t.discount_percentage}%
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !dirty}
          data-testid={`button-save-tier-${delegation.id}`}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function RequestForm({
  open,
  onOpenChange,
  provider,
  editTarget,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  provider: ProviderInfo;
  editTarget?: DelegationRow | null;
  onSuccess: () => void | Promise<void>;
}) {
  const isEditing = !!editTarget;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [scopeRefills, setScopeRefills] = useState(true);
  const [scopeNewRx, setScopeNewRx] = useState(true);
  const [acknowledge, setAcknowledge] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setScopeRefills(true);
    setScopeNewRx(false);
    setAcknowledge(false);
    setPassword("");
  };

  // Seed the form whenever it opens — from editTarget when editing, or
  // back to blank defaults otherwise. Tracking editTarget?.id ensures we
  // re-seed if the user opens the dialog on a different pending row
  // without unmounting the form between clicks.
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setFirstName(editTarget.delegate_first_name);
      setLastName(editTarget.delegate_last_name);
      setEmail(editTarget.delegate_email);
      setPhone(editTarget.delegate_phone || "");
      setTitle(editTarget.delegate_title);
      setScopeRefills(editTarget.scope_refills);
      setScopeNewRx(editTarget.scope_new_rx);
      setAcknowledge(false);
      setPassword("");
    } else {
      reset();
    }
  }, [open, editTarget?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!acknowledge) {
      toast.error("Please confirm you have read and agree to the authorization.");
      return;
    }
    if (!password) {
      toast.error("Re-enter your AimRx password to confirm.");
      return;
    }
    setSubmitting(true);
    try {
      // When editing a pending request, delete the old row first so the
      // unique-active partial index doesn't reject the new insert. The
      // delegation agreement is re-signed on every create, so this also
      // keeps the legal snapshot in sync with the corrected fields.
      if (editTarget) {
        const delRes = await fetch(
          `/api/provider/delegations/${editTarget.id}`,
          { method: "DELETE" },
        );
        if (!delRes.ok) {
          const delJson = await delRes.json().catch(() => ({}));
          throw new Error(
            delJson?.error ?? `Could not update request (${delRes.status})`,
          );
        }
      }

      const res = await fetch("/api/provider/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegate_first_name: firstName,
          delegate_last_name: lastName,
          delegate_email: email,
          delegate_phone: phone || null,
          delegate_title: title,
          scope_refills: scopeRefills,
          scope_new_rx: scopeNewRx,
          password,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(
        editTarget
          ? "Request updated and re-submitted for admin approval."
          : json?.message ?? "Request submitted.",
      );
      reset();
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
      // If the DELETE part of an edit succeeded but the POST failed, the
      // old row is gone — refresh the list so the UI matches reality and
      // the user can re-submit from the still-populated form.
      if (editTarget) {
        await onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const scopeText = [
    scopeRefills && "submit prescription refills",
    scopeNewRx && "submit new prescriptions",
  ]
    .filter(Boolean)
    .join(" and ");

  const providerName =
    `${provider.prefix || "Dr."} ${provider.first_name ?? ""} ${provider.last_name ?? ""}`.trim() || "you";

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Pending Request" : "Request a New Assistant"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? (
              <>
                Update the pending request for{" "}
                <strong>
                  {editTarget?.delegate_first_name}{" "}
                  {editTarget?.delegate_last_name}
                </strong>
                . Saving will replace the previous request and re-submit it for
                admin approval under your NPI{" "}
                <strong>{provider.npi_number}</strong>.
              </>
            ) : (
              <>
                The assistant will submit prescriptions under your NPI{" "}
                <strong>{provider.npi_number}</strong>. You remain the legal
                prescriber on every order. Admin approval is required before she
                can log in.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-delegate-first-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-delegate-last-name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-delegate-email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-delegate-phone"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="title">Title / Role</Label>
            <Input
              id="title"
              placeholder='e.g. "Office Nurse", "Medical Assistant"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-delegate-title"
            />
            <p className="text-xs text-gray-500">
              You name it however you want — this label appears in audit logs.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Scope</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={scopeRefills}
                onCheckedChange={(v) => setScopeRefills(!!v)}
                data-testid="checkbox-scope-refills"
              />
              May submit prescription refills
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={scopeNewRx}
                onCheckedChange={(v) => setScopeNewRx(!!v)}
                data-testid="checkbox-scope-new-rx"
              />
              May submit new prescriptions
            </label>
            {!scopeRefills && !scopeNewRx && (
              <p className="text-xs text-red-600">
                At least one scope must be selected.
              </p>
            )}
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-semibold">Authorization summary</p>
            <p className="mt-1">
              {firstName || "(assistant)"} {lastName} ({title || "(title)"}) will{" "}
              {scopeText || "(no scope)"} on behalf of <strong>{providerName}</strong>{" "}
              under NPI <strong>{provider.npi_number}</strong>. Your existing
              signature on file will be captured as your authorization. You may
              revoke at any time.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={acknowledge}
              onCheckedChange={(v) => setAcknowledge(!!v)}
              className="mt-0.5"
              data-testid="checkbox-acknowledge"
            />
            <span>
              I have read and agree to the authorization terms above. I
              understand every prescription submitted by this assistant will be
              transmitted under my NPI and that I remain legally responsible for
              each one.
            </span>
          </label>

          <div className="space-y-1 border-t pt-4">
            <Label htmlFor="step-up-password">
              Re-enter your AimRx password to confirm
            </Label>
            <Input
              id="step-up-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-testid="input-step-up-password"
            />
            <p className="text-xs text-gray-500">
              Required for any high-trust authorization (step-up authentication).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="button-cancel-request"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !firstName ||
              !lastName ||
              !email ||
              !title ||
              (!scopeRefills && !scopeNewRx) ||
              !acknowledge ||
              !password
            }
            data-testid="button-submit-request"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {isEditing ? "Saving…" : "Submitting…"}
              </>
            ) : isEditing ? (
              "Save & Re-submit for Approval"
            ) : (
              "Send to Admin for Approval"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  target,
  onClose,
  onSuccess,
}: {
  target: DelegationRow | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!target) setReason("");
  }, [target]);

  const handleConfirm = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/provider/delegations/${target.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(json?.message ?? "Revoked.");
      onClose();
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke authorization?</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                <strong>
                  {target.delegate_first_name} {target.delegate_last_name}
                </strong>{" "}
                ({target.delegate_title}) will immediately lose the ability to
                submit prescriptions on your behalf. Past prescriptions are not
                affected.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="revoke-reason">Reason (optional)</Label>
          <Input
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. no longer with the practice"
            data-testid="input-revoke-reason"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            data-testid="button-cancel-revoke"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="button-confirm-revoke"
          >
            {submitting ? "Revoking…" : "Revoke now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmation dialog for the provider self-serve "Delete" action on a
 * pending Provider Assistance request. Hits DELETE
 * /api/provider/delegations/[id], which only succeeds while the request is
 * still in status 'pending_admin'. Active or in-progress assistants must
 * use the Revoke flow instead.
 */
function DeleteDialog({
  target,
  onClose,
  onSuccess,
}: {
  target: DelegationRow | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/provider/delegations/${target.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(json?.message ?? "Request deleted.");
      onClose();
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete pending request?</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                The pending request for{" "}
                <strong>
                  {target.delegate_first_name} {target.delegate_last_name}
                </strong>{" "}
                ({target.delegate_title}) will be removed and never reach the
                admin&apos;s queue. You can submit a new request anytime.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="button-confirm-delete"
          >
            {submitting ? "Deleting…" : "Delete request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
