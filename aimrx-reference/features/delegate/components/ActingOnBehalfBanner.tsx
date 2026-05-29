"use client";

import { ShieldCheck, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActingOnBehalfProvider {
  delegation_id: string;
  provider_id: string;
  provider_user_id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  npi_number: string | null;
  scope_refills: boolean;
  scope_new_rx: boolean;
  delegate_title: string;
}

interface Props {
  current: ActingOnBehalfProvider;
  options: ActingOnBehalfProvider[];
  onChange: (next: ActingOnBehalfProvider) => void;
}

/**
 * Persistent banner that makes it impossible for a delegate to forget
 * which provider she is currently acting on behalf of. When she has more
 * than one authorization, the banner doubles as a switcher.
 *
 * The banner is a legal/compliance artifact — every action a delegate
 * takes is attributed to the provider shown here.
 */
export function ActingOnBehalfBanner({ current, options, onChange }: Props) {
  const providerLabel = `${current.prefix || "Dr."} ${current.first_name ?? ""} ${current.last_name ?? ""}`.trim();
  const npiLabel = current.npi_number ? `NPI ${current.npi_number}` : "no NPI";
  const hasMultiple = options.length > 1;

  const scopeLabel = [
    current.scope_refills && "refills",
    current.scope_new_rx && "new prescriptions",
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4"
      data-testid="banner-acting-on-behalf"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="text-amber-900">
            You are acting on behalf of{" "}
            <span
              className="font-semibold"
              data-testid="text-acting-provider-name"
            >
              {providerLabel || "—"}
            </span>{" "}
            <span className="text-amber-800">({npiLabel})</span>
          </div>
          <div className="text-amber-800 mt-0.5">
            Your role: {current.delegate_title} · Scope: {scopeLabel || "none"}
          </div>
          <div className="text-xs text-amber-700 mt-1">
            Every prescription you submit is attributed to this provider in
            our records and at the pharmacy.
          </div>
        </div>
      </div>

      {hasMultiple && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-1 rounded border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            data-testid="button-switch-provider"
          >
            Switch <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {options.map((opt) => (
              <DropdownMenuItem
                key={opt.delegation_id}
                onClick={() => onChange(opt)}
                data-testid={`menu-switch-provider-${opt.provider_id}`}
                className="cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {opt.prefix || "Dr."} {opt.first_name} {opt.last_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    NPI {opt.npi_number ?? "—"} · {opt.delegate_title}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
