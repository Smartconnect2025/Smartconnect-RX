import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requireAnyAdmin, requireNonDemo, createGuardErrorResponse } from "@/core/auth/api-guards";

export async function DELETE(request: Request) {
  try {
    const adminCheck = await requireAnyAdmin();
    if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { searchParams } = new URL(request.url);
    const emailToDelete = searchParams.get("email");

    if (!emailToDelete) {
      return NextResponse.json(
        { success: false, error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, user_id")
      .eq("email", emailToDelete)
      .single();

    if (providerError || !provider) {
      console.error("Error finding provider:", providerError);
      return NextResponse.json(
        { success: false, error: `Provider with email ${emailToDelete} not found`, details: providerError?.message },
        { status: 404 }
      );
    }

    if (adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId) {
      const { data: link } = await supabase
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

    const userIdToDelete = provider.user_id;
    const providerId = provider.id;

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userIdToDelete);

    if (authError || !authUser.user) {
      console.error("Error fetching auth user:", authError);
      return NextResponse.json(
        { success: false, error: `Auth user not found for provider ${emailToDelete}`, details: authError?.message },
        { status: 404 }
      );
    }

    const deleteErrors: string[] = [];

    if (providerId) {
      const { error: encErr } = await supabase.from("encounters").delete().eq("provider_id", providerId);
      if (encErr) deleteErrors.push(`encounters: ${encErr.message}`);

      const { error: patErr } = await supabase.from("patients").delete().eq("provider_id", providerId);
      if (patErr) deleteErrors.push(`patients: ${patErr.message}`);
    }

    const { error: linkErr } = await supabase.from("provider_pharmacy_links").delete().eq("provider_id", userIdToDelete);
    if (linkErr) deleteErrors.push(`provider_pharmacy_links: ${linkErr.message}`);

    const { error: paErr } = await supabase.from("pharmacy_admins").delete().eq("user_id", userIdToDelete);
    if (paErr) deleteErrors.push(`pharmacy_admins: ${paErr.message}`);

    const { error: provErr } = await supabase.from("providers").delete().eq("user_id", userIdToDelete);
    if (provErr) deleteErrors.push(`providers: ${provErr.message}`);

    const { error: roleErr } = await supabase.from("user_roles").delete().eq("user_id", userIdToDelete);
    if (roleErr) deleteErrors.push(`user_roles: ${roleErr.message}`);

    if (deleteErrors.length > 0) {
      console.error("Errors during cascade delete:", deleteErrors);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete user", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted provider: ${emailToDelete} (ID: ${userIdToDelete})`,
    });
  } catch (error) {
    console.error("Error in delete provider:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete provider",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
