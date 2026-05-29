import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    // Look up role first so we can short-circuit for delegates.
    // Provider Assistance: an assistant is provisioned as a regular provider
    // row but with NPI/license/signature intentionally NULL — those belong
    // to the AUTHORIZING provider, not the assistant. So the standard
    // "your profile is incomplete" warnings don't apply to delegates.
    const { data: userRoleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRoleRow?.role === "delegate") {
      // Manning-incident fix (May 9 2026, Task #64): a delegate's OWN
      // providers row legitimately has no NPI / signature, but every
      // outgoing prescription is rendered against the AUTHORIZING
      // provider's row. If THAT row is incomplete, every Greenwich
      // submission silently fails the 200KB hard-gate.
      //
      // Existing UI consumer (app/(features)/prescriptions/page.tsx)
      // pops the "complete your profile" modal when ANY of
      // missing.{npi,medicalLicense,signature} is true. So for delegates
      // we now return THAT same shape filled in from the AUTHORIZING
      // provider's row — modal copy stays generic ("complete your
      // profile") but the assistant gets blocked from submitting until
      // their supervising provider's row is whole. The new
      // `isDelegate: true` flag lets future UI customize wording without
      // breaking the existing block.
      const { data: delegation } = await adminClient
        .from("delegations")
        .select(
          "providers:provider_id(npi_number, medical_licenses, signature_url)",
        )
        .eq("delegate_user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const linked = delegation?.providers as
        | { npi_number?: string | null; medical_licenses?: unknown; signature_url?: string | null }
        | { npi_number?: string | null; medical_licenses?: unknown; signature_url?: string | null }[]
        | null
        | undefined;
      const ap = Array.isArray(linked) ? linked[0] : linked;

      // No active delegation → assistant cannot submit anyway; surface
      // as "all missing" so the modal blocks immediately.
      if (!ap) {
        return NextResponse.json({
          success: true,
          isDelegate: true,
          authorizingProviderResolved: false,
          missing: { npi: true, medicalLicense: true, signature: true },
        });
      }

      const apHasNPI = Boolean(ap.npi_number?.toString().trim());
      const apHasLicense =
        Array.isArray(ap.medical_licenses) &&
        ap.medical_licenses.length > 0 &&
        ap.medical_licenses.some(
          (l: { licenseNumber?: string; state?: string }) =>
            l && l.licenseNumber && l.state,
        );
      const apHasSignature = Boolean(ap.signature_url?.toString().trim());

      return NextResponse.json({
        success: true,
        isDelegate: true,
        authorizingProviderResolved: true,
        missing: {
          npi: !apHasNPI,
          medicalLicense: !apHasLicense,
          signature: !apHasSignature,
        },
      });
    }

    const { data: provider, error: providerError } = await adminClient
      .from("providers")
      .select("npi_number, medical_licenses, signature_url")
      .eq("user_id", user.id)
      .single();

    if (providerError || !provider) {
      if (userRoleRow?.role === "provider") {
        return NextResponse.json({
          success: true,
          providerNotFound: true,
          missing: { npi: true, medicalLicense: true, signature: true },
        });
      }

      return NextResponse.json({
        success: true,
        missing: { npi: false, medicalLicense: false, signature: false },
      });
    }

    const hasNPI = Boolean(provider.npi_number?.trim());
    const hasLicense =
      Array.isArray(provider.medical_licenses) &&
      provider.medical_licenses.length > 0 &&
      provider.medical_licenses.some(
        (l: { licenseNumber?: string; state?: string }) =>
          l.licenseNumber && l.state,
      );
    const hasSignature = Boolean(provider.signature_url);

    return NextResponse.json({
      success: true,
      missing: {
        npi: !hasNPI,
        medicalLicense: !hasLicense,
        signature: !hasSignature,
      },
    });
  } catch (error) {
    console.error("Profile check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
