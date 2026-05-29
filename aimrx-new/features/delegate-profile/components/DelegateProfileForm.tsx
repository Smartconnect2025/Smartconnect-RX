"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { US_STATES } from "@/features/basic-emr/constants";

type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

const EMPTY_ADDRESS: Address = {
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "USA",
};

function isComplete(a: Address): boolean {
  return Boolean(
    a.street.trim() &&
      a.city.trim() &&
      a.state.trim() &&
      a.zipCode.trim() &&
      a.country.trim(),
  );
}

function AddressFields({
  prefix,
  value,
  onChange,
  disabled,
}: {
  prefix: string;
  value: Address;
  onChange: (next: Address) => void;
  disabled?: boolean;
}) {
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor={`${prefix}-street`}>Street address</Label>
        <Input
          id={`${prefix}-street`}
          data-testid={`input-${prefix}-street`}
          value={value.street}
          disabled={disabled}
          onChange={(e) => set("street", e.target.value)}
          placeholder="123 Main St, Suite 200"
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-city`}>City</Label>
        <Input
          id={`${prefix}-city`}
          data-testid={`input-${prefix}-city`}
          value={value.city}
          disabled={disabled}
          onChange={(e) => set("city", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-state`}>State</Label>
        <Select
          value={value.state}
          disabled={disabled}
          onValueChange={(v) => set("state", v)}
        >
          <SelectTrigger
            id={`${prefix}-state`}
            data-testid={`select-${prefix}-state`}
          >
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${prefix}-zip`}>ZIP code</Label>
        <Input
          id={`${prefix}-zip`}
          data-testid={`input-${prefix}-zip`}
          value={value.zipCode}
          disabled={disabled}
          onChange={(e) => set("zipCode", e.target.value)}
          placeholder="12345"
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-country`}>Country</Label>
        <Input
          id={`${prefix}-country`}
          data-testid={`input-${prefix}-country`}
          value={value.country}
          disabled={disabled}
          onChange={(e) => set("country", e.target.value)}
        />
      </div>
    </div>
  );
}

export function DelegateProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [physical, setPhysical] = useState<Address>(EMPTY_ADDRESS);
  const [billing, setBilling] = useState<Address>(EMPTY_ADDRESS);
  const [sameAsPhysical, setSameAsPhysical] = useState(true);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/delegate/profile", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json = await res.json();
        if (cancelled) return;
        const p = (json.profile?.physical_address as Address | null) ?? null;
        const b = (json.profile?.billing_address as Address | null) ?? null;
        if (p) setPhysical({ ...EMPTY_ADDRESS, ...p });
        if (b) setBilling({ ...EMPTY_ADDRESS, ...b });
        // If billing exists and differs from physical, auto-uncheck.
        if (p && b && JSON.stringify(p) !== JSON.stringify(b)) {
          setSameAsPhysical(false);
        } else if (b && !p) {
          setSameAsPhysical(false);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load profile",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror physical → billing whenever the checkbox is on
  useEffect(() => {
    if (sameAsPhysical) setBilling(physical);
  }, [sameAsPhysical, physical]);

  const handleSave = async () => {
    if (!isComplete(physical)) {
      toast.error("Please complete the physical address");
      return;
    }
    const billingToSave = sameAsPhysical ? physical : billing;
    if (!isComplete(billingToSave)) {
      toast.error("Please complete the billing address");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/delegate/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          physical_address: physical,
          billing_address: billingToSave,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? `Save failed (${res.status})`);
      }
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-physical-address">
        <CardHeader>
          <CardTitle>Physical address</CardTitle>
          <CardDescription>
            Where you are physically located while assisting providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddressFields
            prefix="physical"
            value={physical}
            onChange={setPhysical}
          />
        </CardContent>
      </Card>

      <Card data-testid="card-billing-address">
        <CardHeader>
          <CardTitle>Billing address</CardTitle>
          <CardDescription>
            Used on invoices and payment records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="billing-same"
              data-testid="checkbox-billing-same"
              checked={sameAsPhysical}
              onCheckedChange={(c) => setSameAsPhysical(c === true)}
            />
            <Label htmlFor="billing-same" className="cursor-pointer">
              Same as physical address
            </Label>
          </div>
          {!sameAsPhysical && (
            <AddressFields
              prefix="billing"
              value={billing}
              onChange={setBilling}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          data-testid="button-save-delegate-profile"
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save profile
        </Button>
      </div>
    </div>
  );
}
