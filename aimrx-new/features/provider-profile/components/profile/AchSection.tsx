"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface AchRow {
  bank_name: string | null;
  account_holder: string | null;
  account_last4: string | null;
  account_type: string | null;
  fmv_disclosure_accepted_at: string | null;
  fmv_disclosure_version: string | null;
  updated_at: string | null;
}

interface EditState {
  bank_name: string;
  account_holder: string;
  routing_number: string;
  account_number: string;
  account_type: string;
  fmv_accepted: boolean;
}

const EMPTY_EDIT: EditState = {
  bank_name: "",
  account_holder: "",
  routing_number: "",
  account_number: "",
  account_type: "checking",
  fmv_accepted: false,
};

export function AchSection() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [ach, setAch] = useState<AchRow | null>(null);
  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/provider/ach");
      if (res.ok) {
        const data = await res.json();
        setAch(data.ach || null);
      }
    } catch (err) {
      console.error("Failed to load ACH info:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function startEdit() {
    setEdit({
      bank_name: ach?.bank_name || "",
      account_holder: ach?.account_holder || "",
      routing_number: "",
      account_number: "",
      account_type: ach?.account_type || "checking",
      fmv_accepted: Boolean(ach?.fmv_disclosure_accepted_at),
    });
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEdit(EMPTY_EDIT);
  }

  function hasAnyBankingInput(): boolean {
    return Boolean(
      edit.bank_name.trim() ||
        edit.account_holder.trim() ||
        edit.routing_number.replace(/\D/g, "") ||
        edit.account_number.replace(/\D/g, "")
    );
  }

  async function handleSave() {
    if (hasAnyBankingInput() && !edit.fmv_accepted) {
      toast.error("Please accept the disclosure before saving banking info");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/provider/ach", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: edit.bank_name || null,
          account_holder: edit.account_holder || null,
          routing_number: edit.routing_number || null,
          account_number: edit.account_number || null,
          account_type: edit.account_type || null,
          fmv_disclosure_accepted: edit.fmv_accepted,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to save banking info");
        return;
      }
      toast.success("Banking info saved");
      setIsEditing(false);
      setEdit(EMPTY_EDIT);
      await load();
    } catch (err) {
      console.error("ACH save error:", err);
      toast.error("Failed to save banking info");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading banking info…
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="section-ach">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Direct Deposit (ACH)</h3>
        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startEdit}
            data-testid="button-edit-ach"
          >
            {ach ? "Update" : "Add"} Banking Info
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Used for direct deposit of FMV consult payments. Account & routing
        numbers are encrypted at rest. Only the last 4 digits are ever shown
        back to you.
      </p>

      {!isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Bank</div>
            <div data-testid="text-ach-bank">{ach?.bank_name || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Account Holder</div>
            <div data-testid="text-ach-holder">{ach?.account_holder || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Account</div>
            <div data-testid="text-ach-last4">
              {ach?.account_last4 ? `••••${ach.account_last4}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Type</div>
            <div data-testid="text-ach-type">{ach?.account_type || "—"}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-muted-foreground">
              FMV Disclosure Accepted
            </div>
            <div data-testid="text-ach-fmv">
              {ach?.fmv_disclosure_accepted_at
                ? new Date(ach.fmv_disclosure_accepted_at).toLocaleString()
                : "Not yet accepted"}
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="space-y-3 rounded-md border border-gray-200 p-4 bg-gray-50">
          <div
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2"
            data-testid="disclosure-fmv-profile"
          >
            <p>
              AIMRx is a SaaS platform that provides unique workflow and access
              benefits to Prescribers. The assessed Fair Market Value of this
              service has been determined to be <strong>$25 per interaction</strong>,
              and this is assessed in the checkout cart of each transaction.
            </p>
            <p>
              There is an optional feature available in the prescription process
              allowing Prescribers to charge their consult fee (Medication
              Oversight/Management) using our payment processing service. This
              dollar amount will add up throughout the month and will be visible
              in your Account Profile Home Page. If you choose to use this
              service, these funds will be paid back to you in full via ACH every
              month. Please complete the ACH information below if you plan to
              use this service.
            </p>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="ach-fmv-accept"
              checked={edit.fmv_accepted}
              onCheckedChange={(checked) =>
                setEdit((s) => ({ ...s, fmv_accepted: checked === true }))
              }
              data-testid="checkbox-ach-fmv"
            />
            <Label
              htmlFor="ach-fmv-accept"
              className="text-sm font-normal cursor-pointer leading-snug"
            >
              I have read and acknowledge the disclosure above
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ach-bank-name">Bank Name</Label>
              <Input
                id="ach-bank-name"
                value={edit.bank_name}
                onChange={(e) => setEdit((s) => ({ ...s, bank_name: e.target.value }))}
                data-testid="input-ach-bank-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-account-holder">Account Holder Name</Label>
              <Input
                id="ach-account-holder"
                value={edit.account_holder}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, account_holder: e.target.value }))
                }
                data-testid="input-ach-account-holder"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-routing">Routing Number</Label>
              <Input
                id="ach-routing"
                value={edit.routing_number}
                onChange={(e) =>
                  setEdit((s) => ({
                    ...s,
                    routing_number: e.target.value.replace(/\D/g, ""),
                  }))
                }
                inputMode="numeric"
                maxLength={9}
                placeholder={
                  ach?.account_last4
                    ? "Leave blank to keep existing routing on file"
                    : "9 digits"
                }
                data-testid="input-ach-routing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-account">Account Number</Label>
              <Input
                id="ach-account"
                value={edit.account_number}
                onChange={(e) =>
                  setEdit((s) => ({
                    ...s,
                    account_number: e.target.value.replace(/\D/g, ""),
                  }))
                }
                inputMode="numeric"
                maxLength={20}
                placeholder={
                  ach?.account_last4
                    ? `Leave blank to keep ••••${ach.account_last4}`
                    : "Account number"
                }
                data-testid="input-ach-account"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ach-account-type">Account Type</Label>
              <Select
                value={edit.account_type}
                onValueChange={(value) =>
                  setEdit((s) => ({ ...s, account_type: value }))
                }
              >
                <SelectTrigger id="ach-account-type" data-testid="select-ach-account-type">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={cancelEdit}
              disabled={isSaving}
              data-testid="button-cancel-ach"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-ach"
            >
              {isSaving ? "Saving…" : "Save Banking Info"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
