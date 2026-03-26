import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requireAnyAdmin, requireNonDemo, createGuardErrorResponse } from "@/core/auth/api-guards";

export async function POST(request: Request) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  const demoCheck = await requireNonDemo();
  if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

  const supabaseAdmin = createAdminClient();

  try {
    const body = await request.json();
    const { email: providerEmail, newPassword } = body;

    if (!providerEmail || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Email and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("id, user_id, first_name, last_name")
      .eq("email", providerEmail)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { success: false, error: `Provider with email ${providerEmail} not found` },
        { status: 404 }
      );
    }

    if (adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId) {
      const { data: link } = await supabaseAdmin
        .from("provider_pharmacy_links")
        .select("id")
        .eq("provider_id", provider.id)
        .eq("pharmacy_id", adminCheck.pharmacyScope.pharmacyId)
        .maybeSingle();

      if (!link) {
        return NextResponse.json(
          { success: false, error: "Provider not found within your pharmacy" },
          { status: 403 }
        );
      }
    }

    const userIdToUpdate = provider.user_id;

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userIdToUpdate,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update password", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password successfully reset for Dr. ${provider.first_name} ${provider.last_name}`,
      email: providerEmail,
    });
  } catch (error) {
    console.error("Error in reset provider password:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset password",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
