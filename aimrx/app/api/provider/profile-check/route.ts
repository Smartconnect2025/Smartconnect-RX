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

    const { data: provider, error: providerError } = await adminClient
      .from("providers")
      .select("npi_number, medical_licenses, signature_url")
      .eq("user_id", user.id)
      .single();

    if (providerError || !provider) {
      const { data: userRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (userRole?.role === "provider") {
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
