"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Ban,
  RefreshCw,
  Building2,
  Save,
  ChevronDown,
  ChevronRight,
  MapPin,
  Trash2,
  Percent,
  Receipt,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type DelegationRow = {
  id: string;
  delegate_first_name: string;
  delegate_last_name: string;
  delegate_email: string;
  delegate_phone: string | null;
  delegate_title: string;
  delegate_user_id: string | null;
  scope_refills: boolean;
  scope_new_rx: boolean;
  status:
    | "pending_admin"
    | "pending_delegate"
    | "active"
    | "rejected"
    | "revoked";
  provider_signed_at: string | null;
  admin_action_at: string | null;
  admin_rejection_reason: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  provider_id: string;
  providers: {
    id: string;
    prefix: string | null;
    first_name: string | null;
    last_name: string | null;
    npi_number: string | null;
    company_name: string | null;
    email: string | null;
  } | null;
  // The assistant's OWN providers row (provisioned at admin approval).
  // Carries the assistant's id (used as the PATCH target for company_name
  // AND for the per-assistant tier override) and her current clinic +
  // tier assignment. tier_code is the override on her own row; when null
  // she falls back to the supervising provider's tier.
  assistant_provider: {
    id: string;
    company_name: string | null;
    tier_code: string | null;
    tier_name: string | null;
    discount_percentage: number | null;
    // Per-assistant billing-on-terms toggle. When true, every
    // prescription she submits is auto-marked paid and shipped without
    // a patient receipt — same as a regular billed-on-terms provider.
    // Edited via the AssignPayOnTermsRow on each card.
    pay_on_terms: boolean;
  } | null;
  // The assistant's self-filled physical and billing addresses, returned by
  // the same admin list call. Either field may be null until she saves it.
  delegate_profile: {
    physical_address: DelegateAddress | null;
    billing_address: DelegateAddress | null;
  };
};

type DelegateAddress = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
};

function formatAddress(a: DelegateAddress | null): string | null {
  if (!a) return null;
  const parts = [
    a.street,
    [a.city, a.state].filter(Boolean).join(", "),
    a.zipCode,
    a.country,
  ].filter((p) => p && String(p).trim().length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Mirrors the 5-field check enforced by the API and the Stage 3 form. Used
// purely for the cosmetic "profile complete" annotation on the Active pill —
// this never gates contract status, activation, or prescription submission.
function isAddressComplete(a: DelegateAddress | null | undefined): boolean {
  if (!a || typeof a !== "object") return false;
  return Boolean(
    a.street && String(a.street).trim() &&
      a.city && String(a.city).trim() &&
      a.state && String(a.state).trim() &&
      a.zipCode && String(a.zipCode).trim() &&
      a.country && String(a.country).trim(),
  );
}

function isDelegateProfileComplete(
  p: DelegationRow["delegate_profile"] | null | undefined,
): boolean {
  if (!p) return false;
  return (
    isAddressComplete(p.physical_address) &&
    isAddressComplete(p.billing_address)
  );
}

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function StatusBadge({
  status,
  profileComplete,
}: {
  status: DelegationRow["status"];
  /**
   * Optional cosmetic annotation for the "active" status only:
   *   true  → green "Active — profile complete"
   *   false → amber "Active — awaiting profile"
   *   null/undefined → existing green "Active" (default)
   * Ignored for every non-active status. Does NOT affect contract state.
   */
  profileComplete?: boolean | null;
}) {
  const map: Record<
    DelegationRow["status"],
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    pending_admin: {
      label: "Awaiting Admin",
      cls: "bg-amber-100 text-amber-900 border-amber-300",
      icon: <Clock className="w-3 h-3" />,
    },
    pending_delegate: {
      label: "Awaiting Assistant Sign-In",
      cls: "bg-blue-100 text-blue-900 border-blue-300",
      icon: <Clock className="w-3 h-3" />,
    },
    active: {
      label: "Active",
      cls: "bg-green-100 text-green-900 border-green-300",
      icon: <ShieldCheck className="w-3 h-3" />,
    },
    rejected: {
      label: "Rejected",
      cls: "bg-gray-100 text-gray-900 border-gray-300",
      icon: <XCircle className="w-3 h-3" />,
    },
    revoked: {
      label: "Revoked",
      cls: "bg-red-100 text-red-900 border-red-300",
      icon: <Ban className="w-3 h-3" />,
    },
  };
  let cfg = map[status];
  // Cosmetic annotation only, when caller provided profile-completeness for
  // an Active row. Underlying status stays "active" — see test id below.
  if (status === "active" && profileComplete === true) {
    cfg = { ...cfg, label: "Active — profile complete" };
  } else if (status === "active" && profileComplete === false) {
    cfg = {
      label: "Active — awaiting profile",
      cls: "bg-amber-100 text-amber-900 border-amber-300",
      icon: <Clock className="w-3 h-3" />,
    };
  }
  return (
    <Badge
      variant="outline"
      className={`${cfg.cls} flex items-center gap-1 font-medium`}
      data-testid={`status-${status}`}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

/**
 * Inline Company-assignment row for an approved assistant.
 *
 * The same Company dropdown the admin uses on the providers table — placed
 * here so the admin can drop the assistant into a clinic group. The PATCH
 * endpoint (`/api/admin/providers/[id]`) already calls the existing
 * `sync_provider_to_group_patients` and `remove_non_owned_patient_mappings`
 * RPCs, so the assistant immediately starts seeing every patient in the
 * clinic and any patients she adds become visible to the rest of the
 * clinic too.
 */
function AssignClinicRow({
  delegation,
  companies,
  onSaved,
}: {
  delegation: DelegationRow;
  companies: string[];
  onSaved: () => void;
}) {
  const initial = delegation.assistant_provider?.company_name ?? "";
  const [value, setValue] = useState<string>(initial);
  const [saving, setSaving] = useState(false);

  if (!delegation.assistant_provider) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        This assistant has no provider profile. This usually means the account
        was approved before the Provider Assistance feature shipped. Please
        create a providers row for{" "}
        <strong>{delegation.delegate_email}</strong> manually from the
        Providers admin page, then return here to assign a clinic.
      </div>
    );
  }

  const dirty = (value || "") !== (initial || "");

  async function save() {
    if (!delegation.assistant_provider) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/providers/${delegation.assistant_provider.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_name: value || null }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(
        value
          ? `Assigned to ${value}. Patient panel synced.`
          : "Removed from clinic. Shared patients revoked.",
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const NONE = "__none__";

  return (
    <div className="rounded-md bg-indigo-50/50 border border-indigo-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-indigo-700" />
        <div className="text-sm font-semibold text-indigo-900">
          Clinic / Company Assignment
        </div>
      </div>
      <p className="text-xs text-indigo-900/80 mb-2">
        Assign this assistant to a clinic. She will automatically share the
        patient panel with every provider and assistant in the clinic.
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={value || NONE}
          onValueChange={(v) => setValue(v === NONE ? "" : v)}
        >
          <SelectTrigger
            className="bg-white"
            data-testid={`select-company-${delegation.id}`}
          >
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value={NONE} className="py-2 text-sm">
              <span className="text-gray-500">— Unassigned —</span>
            </SelectItem>
            {companies.length === 0 ? (
              <SelectItem value="no-companies" disabled>
                No clinics defined yet
              </SelectItem>
            ) : (
              companies.map((c) => (
                <SelectItem
                  key={c}
                  value={c}
                  className="py-2 text-sm cursor-pointer"
                  data-testid={`select-option-company-${delegation.id}-${c}`}
                >
                  {c}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !dirty}
          data-testid={`button-save-company-${delegation.id}`}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

type Tier = {
  tier_code: string;
  tier_name: string;
  discount_percentage: number | string;
  description?: string | null;
};

/**
 * Inline per-assistant tier override.
 *
 * The admin can pin a specific pricing tier on this assistant's `providers`
 * row. When set, the patient is charged at that tier on every prescription
 * she submits — overriding the supervising provider's tier. When cleared
 * (Unassigned), she falls back to the supervising provider's tier — same
 * behavior as before this feature shipped, so existing assistants are
 * unaffected.
 */
function AssignTierRow({
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

  if (!delegation.assistant_provider) {
    // Mirror the AssignClinicRow safeguard. The lookup row hasn't been
    // provisioned (legacy pre-feature delegation), so we cannot target it.
    return null;
  }

  const dirty = (value || "") !== (initial || "");
  const NONE = "__none__";

  async function save() {
    if (!delegation.assistant_provider) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/providers/tier-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: delegation.assistant_provider.id,
          tierCode: value || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(
        value
          ? `Tier ${value} assigned to this assistant.`
          : "Tier override cleared. Assistant will use the supervising provider's tier.",
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
          Per-Assistant Pricing Tier
        </div>
        {delegation.assistant_provider.tier_code ? (
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
            Uses doctor&apos;s tier
          </Badge>
        )}
      </div>
      <p className="text-xs text-emerald-900/80 mb-2">
        Override the supervising provider&apos;s tier for this assistant only.
        Leave as &ldquo;Unassigned&rdquo; to keep her on the supervising
        provider&apos;s tier.
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
            <SelectValue placeholder="Use doctor's tier (default)" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value={NONE} className="py-2 text-sm">
              <span className="text-gray-500">
                — Use doctor&apos;s tier (default) —
              </span>
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

/**
 * Inline per-assistant "Mark orders Paid on Terms" toggle.
 *
 * Mirrors the existing per-provider checkbox in the admin Edit Provider
 * modal. When ON, every prescription this assistant submits is
 * auto-marked paid and shipped straight to the pharmacy — no patient
 * receipt, no payment link, no patient-facing email or SMS. Use for
 * assistants of providers who are billed on terms (one card on file,
 * monthly invoice, etc.). Audit-logged on every change.
 */
function AssignPayOnTermsRow({
  delegation,
  onSaved,
}: {
  delegation: DelegationRow;
  onSaved: () => void;
}) {
  const initial = delegation.assistant_provider?.pay_on_terms === true;
  const [enabled, setEnabled] = useState<boolean>(initial);
  const [saving, setSaving] = useState(false);

  // Resync when the parent reloads. Without this, the switch could
  // appear "dirty" right after Save because `initial` updated but local
  // `enabled` didn't.
  useEffect(() => {
    setEnabled(delegation.assistant_provider?.pay_on_terms === true);
  }, [delegation.assistant_provider?.pay_on_terms]);

  if (!delegation.assistant_provider) {
    // Same gate as the other rows — the assistant's own providers row
    // doesn't exist yet, so we have no target to write to.
    return null;
  }

  const dirty = enabled !== initial;

  async function save() {
    if (!delegation.assistant_provider) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/providers/pay-on-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: delegation.assistant_provider.id,
          payOnTerms: enabled,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success(
        enabled
          ? "Billed on terms enabled. Her orders will auto-pay (no patient receipt)."
          : "Billed on terms disabled. Her orders will go through normal patient payment.",
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      // Roll back the visual toggle on failure so what the admin sees
      // matches what's actually persisted.
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
        payment flow entirely — they are automatically marked as paid and
        submitted straight to the pharmacy.{" "}
        <strong>No payment receipts, payment links, or billing emails/SMS
        are sent to the patient.</strong>{" "}
        Use for assistants of providers billed on terms (one card on file,
        monthly invoice, etc.).
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

function AddressBlock({
  label,
  address,
  testId,
}: {
  label: string;
  address: DelegateAddress | null;
  testId: string;
}) {
  const formatted = formatAddress(address);
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <div className="flex items-center gap-1.5 font-semibold text-gray-800">
        <MapPin className="h-3.5 w-3.5" />
        {label}
      </div>
      {formatted ? (
        <div
          className="mt-1 text-gray-700"
          data-testid={`text-${testId}-${"value"}`}
        >
          {formatted}
        </div>
      ) : (
        <div
          className="mt-1 italic text-gray-500"
          data-testid={`text-${testId}-empty`}
        >
          Not provided yet
        </div>
      )}
    </div>
  );
}

function DelegationCard({
  d,
  companies,
  tiers,
  onApprove,
  onReject,
  onDelete,
  onSaved,
}: {
  d: DelegationRow;
  companies: string[];
  tiers: Tier[];
  onApprove: (d: DelegationRow) => void;
  onReject: (d: DelegationRow) => void;
  onDelete: (d: DelegationRow) => void;
  onSaved: () => void;
}) {
  const providerName = d.providers
    ? `${d.providers.prefix || "Dr."} ${d.providers.first_name ?? ""} ${d.providers.last_name ?? ""}`.trim()
    : "Unknown provider";
  const npi = d.providers?.npi_number ?? "—";

  // Cards needing attention default expanded; everything else defaults
  // collapsed so the admin can scan ~5 assistants per screen.
  const defaultOpen = d.status === "pending_admin";
  const [open, setOpen] = useState(defaultOpen);

  // Cosmetic annotation only — does NOT affect contract status, activation,
  // or any prescription/legal logic. Used solely by the StatusBadge label.
  const profileComplete =
    d.status === "active" ? isDelegateProfileComplete(d.delegate_profile) : null;

  return (
    <Card data-testid={`card-delegation-${d.id}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          asChild
          data-testid={`button-toggle-card-${d.id}`}
        >
          <button
            type="button"
            className="w-full text-left"
            aria-expanded={open}
          >
            <CardHeader className="pb-3 hover:bg-gray-50/60 transition-colors rounded-t-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="pt-1 text-gray-500 flex-shrink-0">
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle
                      className="text-base truncate"
                      data-testid={`text-delegate-name-${d.id}`}
                    >
                      {d.delegate_first_name} {d.delegate_last_name}{" "}
                      <span className="text-xs font-normal text-gray-600">
                        ({d.delegate_title})
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      <span data-testid={`text-delegate-email-${d.id}`}>
                        {d.delegate_email}
                      </span>
                    </CardDescription>
                    <div
                      className="mt-1 text-xs text-gray-700 truncate"
                      data-testid={`text-summary-${d.id}`}
                    >
                      Submits on behalf of{" "}
                      <span className="font-medium">{providerName}</span>
                      {" — NPI "}
                      <span className="font-mono">{npi}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <StatusBadge
                    status={d.status}
                    profileComplete={profileComplete}
                  />
                </div>
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {d.delegate_phone && (
              <div className="text-xs text-gray-600">
                Phone: {d.delegate_phone}
              </div>
            )}

            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm">
              <div className="font-semibold text-blue-900">
                Will submit prescriptions on behalf of:
              </div>
              <div className="mt-1 text-blue-900">
                <span data-testid={`text-provider-name-${d.id}`}>
                  {providerName}
                </span>
                {d.providers?.company_name && (
                  <span className="text-blue-700">
                    {" "}
                    · {d.providers.company_name}
                  </span>
                )}
              </div>
              <div className="mt-1 text-blue-900">
                <span className="font-medium">NPI:</span>{" "}
                <span data-testid={`text-provider-npi-${d.id}`}>{npi}</span>
              </div>
            </div>

            <div className="text-sm">
              <span className="font-medium">Authorized scope:</span>{" "}
              {d.scope_refills && (
                <Badge variant="secondary" className="mr-1">
                  Refills
                </Badge>
              )}
              {d.scope_new_rx && (
                <Badge variant="secondary">New Prescriptions</Badge>
              )}
            </div>

            <div className="text-xs text-gray-500">
              Provider signed:{" "}
              {d.provider_signed_at
                ? new Date(d.provider_signed_at).toLocaleString()
                : "—"}
            </div>

            {d.admin_rejection_reason && (
              <div className="text-sm rounded-md bg-red-50 border border-red-200 p-2">
                <span className="font-medium">Rejection reason:</span>{" "}
                {d.admin_rejection_reason}
              </div>
            )}
            {d.revoke_reason && (
              <div className="text-sm rounded-md bg-red-50 border border-red-200 p-2">
                <span className="font-medium">Revoke reason:</span>{" "}
                {d.revoke_reason}
              </div>
            )}

            {/* Assistant's self-filled physical and billing addresses.
                View-only at this stage — admin cannot edit. */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <AddressBlock
                label="Physical address"
                address={d.delegate_profile?.physical_address ?? null}
                testId={`physical-address-${d.id}`}
              />
              <AddressBlock
                label="Billing address"
                address={d.delegate_profile?.billing_address ?? null}
                testId={`billing-address-${d.id}`}
              />
            </div>

            {/* Provider Assistance — admin can place the assistant in a clinic
                group. Only meaningful once the assistant has signed in and her
                providers row exists, which is from `pending_delegate` onward. */}
            {(d.status === "pending_delegate" || d.status === "active") && (
              <AssignClinicRow
                delegation={d}
                companies={companies}
                onSaved={onSaved}
              />
            )}

            {/* Per-assistant tier override. Same gating as the clinic row —
                requires the assistant's own providers row to exist. */}
            {(d.status === "pending_delegate" || d.status === "active") && (
              <AssignTierRow
                delegation={d}
                tiers={tiers}
                onSaved={onSaved}
              />
            )}

            {/* Per-assistant "Mark orders Paid on Terms" toggle. Same
                gating — meaningful only once her providers row exists. */}
            {(d.status === "pending_delegate" || d.status === "active") && (
              <AssignPayOnTermsRow delegation={d} onSaved={onSaved} />
            )}

            {d.status === "pending_admin" && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => onApprove(d)}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid={`button-approve-${d.id}`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve & Create Account
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onReject(d)}
                  data-testid={`button-reject-${d.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}

            {/* Admin-only hard delete. Available for every status so an admin
                can always clean up a stale, duplicate, or unwanted entry from
                this table. Confirmation dialog is handled in the parent. */}
            <div className="flex justify-end pt-2 border-t border-gray-100 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(d)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                data-testid={`button-delete-${d.id}`}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function ProviderAssistancePage() {
  const [tab, setTab] = useState("pending_admin");
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [approveTarget, setApproveTarget] = useState<DelegationRow | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<DelegationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DelegationRow | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsFetching(true);
    try {
      // Load delegations and the tier catalog in parallel; tier list rarely
      // changes but is needed to render the per-assistant Tier select on
      // every card that has an assistant_provider.
      const [delegRes, tiersRes] = await Promise.all([
        fetch("/api/admin/delegations", { cache: "no-store" }),
        fetch("/api/admin/tiers", { cache: "no-store" }),
      ]);
      if (!delegRes.ok) throw new Error(`Failed to load (${delegRes.status})`);
      const delegJson = (await delegRes.json()) as {
        delegations: DelegationRow[];
        companies?: string[];
      };
      setDelegations(delegJson.delegations ?? []);
      setCompanies(delegJson.companies ?? []);
      // Tier list failure is non-fatal — the Tier picker just shows an empty
      // dropdown, the rest of the page still works.
      if (tiersRes.ok) {
        const tiersJson = (await tiersRes.json()) as { tiers?: Tier[] };
        setTiers(tiersJson.tiers ?? []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setSubmitting(true);
    const submittedPassword = tempPassword;
    const submittedEmail = approveTarget.delegate_email;
    try {
      const res = await fetch(
        `/api/admin/delegations/${approveTarget.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: tempPassword }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      if (json?.emailSent) {
        toast.success(
          "Account created and welcome email sent to the assistant.",
        );
      } else {
        const pw: string =
          typeof json?.tempPassword === "string" && json.tempPassword.length > 0
            ? json.tempPassword
            : submittedPassword;
        toast.warning(
          `Account created, but the welcome email did NOT send (${json?.emailError ?? "unknown error"}). Send these credentials to ${submittedEmail} manually:  Password: ${pw}`,
          { duration: 30000 },
        );
      }
      setApproveTarget(null);
      setTempPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/delegations/${rejectTarget.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success("Delegation request rejected.");
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/delegations/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success("Provider assistance entry deleted.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = delegations.filter((d: DelegationRow) =>
    tab === "all" ? true : d.status === tab,
  );
  const pendingCount = delegations.filter(
    (d: DelegationRow) => d.status === "pending_admin",
  ).length;

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Provider Assistance
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Review and approve assistant accounts requested by providers.
            Approved assistants submit prescriptions under the provider&apos;s
            NPI. Assign the assistant to a clinic to share the patient panel.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw
            className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending_admin" data-testid="tab-pending_admin">
            Pending Approval
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-amber-500 text-white">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="pending_delegate"
            data-testid="tab-pending_delegate"
          >
            Awaiting Sign-In
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejected
          </TabsTrigger>
          <TabsTrigger value="revoked" data-testid="tab-revoked">
            Revoked
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No delegations in this category.
              </CardContent>
            </Card>
          ) : (
            filtered.map((d: DelegationRow) => (
              <DelegationCard
                key={d.id}
                d={d}
                companies={companies}
                tiers={tiers}
                onApprove={(target) => {
                  setApproveTarget(target);
                  setTempPassword(generatePassword());
                }}
                onReject={(target) => {
                  setRejectTarget(target);
                  setRejectReason("");
                }}
                onDelete={(target) => setDeleteTarget(target)}
                onSaved={() => void load()}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Approve dialog */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Create Assistant Account</DialogTitle>
            <DialogDescription>
              An account will be created for{" "}
              <strong>
                {approveTarget?.delegate_first_name}{" "}
                {approveTarget?.delegate_last_name}
              </strong>{" "}
              ({approveTarget?.delegate_email}) and credentials emailed.
            </DialogDescription>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm">
                <div className="font-semibold text-blue-900">
                  This assistant will submit prescriptions under:
                </div>
                <div className="mt-1 text-blue-900">
                  {approveTarget.providers?.prefix || "Dr."} {approveTarget.providers?.first_name}{" "}
                  {approveTarget.providers?.last_name} · NPI{" "}
                  {approveTarget.providers?.npi_number ?? "—"}
                </div>
                <div className="mt-2 text-xs text-blue-800">
                  After approval, you can assign her to a clinic from the
                  card below to share the patient panel automatically.
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temp-password">
                  Temporary Password (assistant will be forced to change at
                  first login)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="temp-password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    data-testid="input-temp-password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTempPassword(generatePassword())}
                    data-testid="button-regenerate-password"
                  >
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Minimum 8 characters. This will be sent to the assistant via
                  email.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              data-testid="button-cancel-approve"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={submitting || tempPassword.length < 8}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-approve"
            >
              {submitting ? "Creating account…" : "Approve & Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Delegation Request</DialogTitle>
            <DialogDescription>
              Please provide a reason. The delegation will be marked rejected
              and recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (min 10 characters)</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || rejectReason.length < 10}
              data-testid="button-confirm-reject"
            >
              {submitting ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Provider Assistance Entry?</DialogTitle>
            <DialogDescription>
              This will permanently remove this entry from the table. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm space-y-1">
              <div>
                <span className="font-medium">Assistant:</span>{" "}
                {deleteTarget.delegate_first_name}{" "}
                {deleteTarget.delegate_last_name} (
                {deleteTarget.delegate_email})
              </div>
              <div>
                <span className="font-medium">For provider:</span>{" "}
                {deleteTarget.providers
                  ? `${deleteTarget.providers.prefix || "Dr."} ${deleteTarget.providers.first_name ?? ""} ${deleteTarget.providers.last_name ?? ""}`.trim()
                  : "Unknown"}
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                {deleteTarget.status}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
              data-testid="button-confirm-delete"
            >
              {submitting ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
