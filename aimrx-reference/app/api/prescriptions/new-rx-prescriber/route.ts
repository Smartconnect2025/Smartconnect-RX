/**
 * GET /api/prescriptions/new-rx-prescriber
 *
 * Returns the AUTHORIZING provider's identity for the new-prescription
 * Step 3 PDF builder. Replaces the brittle client-side `/api/delegate/me`
 * call that:
 *   - omitted `dea_number` from its SELECT,
 *   - silently fell through to an empty `providers` lookup on the
 *     assistant's own row (no NPI / no signature) when no active
 *     delegation existed,
 *   - left the page using the hard-coded placeholder NPI "1234567890"
 *     when both lookups returned nothing.
 *
 * This endpoint:
 *   - For role=delegate, resolves the active delegation via the shared
 *     `resolveActiveAuthorizingProviderForDelegate` helper. No active
 *     delegation → 403.
 *   - For role=provider, returns the caller's own providers row.
 *   - For role=admin, returns the caller's own providers row if it
 *     exists; admins are expected to use admin-assisted flows that pass
 *     prescriber_id explicitly elsewhere.
 *
 * Hard-fails (4xx) when the resolved provider is missing the credentials
 * Step 3 needs to render a healthy Greenwich Electronic Rx PDF. The page
 * MUST refuse to call generatePrescriptionPdf or `/api/prescriptions/submit`
 * on a non-200 response — falling back to placeholders is the Manning bug.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { resolveActiveAuthorizingProviderForDelegate } from "@core/services/authorizing-provider";
import { computeMissingPrescriberFields } from "@core/services/prescriber-credentials";

interface PrescriberPayload {
  provider_user_id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  npi_number: string | null;
  dea_number: string | null;
  company_name: string | null;
  phone_number: string | null;
  signature_url: string | null;
  physical_address: Record<string, unknown> | null;
  via_delegation: boolean;
  delegation_id: string | null;
}

const PROVIDER_COLUMNS =
  "user_id, prefix, first_name, last_name, npi_number, dea_number, company_name, phone_number, signature_url, physical_address, is_active, medical_licenses";

export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();

  let payload: PrescriberPayload | null = null;
  let credSource: {
    npi_number?: string | null;
    signature_url?: string | null;
    medical_licenses?: unknown;
  } | null = null;

  if (userRole === "delegate") {
    const resolved = await resolveActiveAuthorizingProviderForDelegate(
      supabase,
      user.id,
    );
    if (!resolved) {
      await supabase.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: user.email ?? "delegate",
        action: "PRESCRIPTION_PRESCRIBER_LOOKUP_NO_DELEGATION",
        details: `delegateUserId=${user.id} no active delegation found`,
        status: "error",
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "You have no active authorization. Contact your authorizing provider or AimRx support.",
        },
        { status: 403 },
      );
    }
    if (resolved.provider.is_active !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your authorizing provider's account is inactive. Submissions are paused until the provider is reactivated.",
        },
        { status: 403 },
      );
    }
    payload = {
      provider_user_id: resolved.provider.user_id,
      prefix: resolved.provider.prefix,
      first_name: resolved.provider.first_name,
      last_name: resolved.provider.last_name,
      npi_number: resolved.provider.npi_number,
      dea_number: resolved.provider.dea_number,
      company_name: resolved.provider.company_name,
      phone_number: resolved.provider.phone_number,
      signature_url: resolved.provider.signature_url,
      physical_address: resolved.provider.physical_address,
      via_delegation: true,
      delegation_id: resolved.delegationId,
    };
    // Re-load to grab medical_licenses for the validator (the resolver row
    // shape doesn't include it; cheap to re-read once here).
    const { data: cred } = await supabase
      .from("providers")
      .select("npi_number, signature_url, medical_licenses")
      .eq("user_id", resolved.provider.user_id)
      .maybeSingle();
    credSource = cred;
  } else if (userRole === "provider" || userRole === "admin") {
    const { data: row } = await supabase
      .from("providers")
      .select(PROVIDER_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row?.user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Your provider profile was not found. Contact AimRx support.",
        },
        { status: 404 },
      );
    }
    payload = {
      provider_user_id: row.user_id,
      prefix: row.prefix,
      first_name: row.first_name,
      last_name: row.last_name,
      npi_number: row.npi_number,
      dea_number: row.dea_number,
      company_name: row.company_name,
      phone_number: row.phone_number,
      signature_url: row.signature_url,
      physical_address: row.physical_address,
      via_delegation: false,
      delegation_id: null,
    };
    credSource = {
      npi_number: row.npi_number,
      signature_url: row.signature_url,
      medical_licenses: row.medical_licenses,
    };
  } else {
    return NextResponse.json(
      {
        success: false,
        error:
          "Only providers, admins, and authorized assistants can submit prescriptions",
      },
      { status: 403 },
    );
  }

  // Pre-PDF credential gate. Same rules as the unified pre-payment validator
  // in app/api/prescriptions/submit/route.ts. We surface this here too so the
  // UI can show a clean error BEFORE the user clicks Submit (and BEFORE we
  // ever build a placeholder-NPI PDF). DEA is intentionally NOT required —
  // see the "Pre-payment prescriber validator — DEA NOT required" rule in
  // replit.md (May 9 2026, Joseph clarification).
  const missing = computeMissingPrescriberFields(credSource);
  if (missing.length > 0) {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name: user.email ?? userRole ?? "",
      action: "PRESCRIPTION_PRESCRIBER_LOOKUP_INCOMPLETE",
      details:
        `prescriberUserId=${payload.provider_user_id} role=${userRole} ` +
        `viaDelegation=${payload.via_delegation} ` +
        `delegationId=${payload.delegation_id ?? "none"} ` +
        `missing=[${missing.join(",")}]`,
      status: "error",
    });
    const isDelegate = payload.via_delegation;
    return NextResponse.json(
      {
        success: false,
        error: isDelegate
          ? `Cannot submit: your authorizing provider's profile is missing ${missing.join(", ")}. Ask them to complete their profile and try again.`
          : `Cannot submit: your profile is missing ${missing.join(", ")}. Complete your profile and try again.`,
        missing,
        viaDelegation: payload.via_delegation,
      },
      { status: 422 },
    );
  }

  // Audit successful resolution so we can confirm in production that every
  // new submission used this resolver path (no placeholder fallbacks).
  await supabase.from("system_logs").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    user_name: user.email ?? userRole ?? "",
    action: "PRESCRIPTION_PRESCRIBER_LOOKUP_RESOLVED",
    details:
      `prescriberUserId=${payload.provider_user_id} role=${userRole} ` +
      `viaDelegation=${payload.via_delegation} ` +
      `delegationId=${payload.delegation_id ?? "none"} ` +
      `hasNpi=${!!payload.npi_number} hasDea=${!!payload.dea_number} ` +
      `hasSig=${!!payload.signature_url}`,
    status: "info",
  });

  return NextResponse.json({ success: true, prescriber: payload });
}
