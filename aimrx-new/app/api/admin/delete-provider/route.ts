import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

/**
 * Delete a provider by email (admin access)
 * DELETE /api/admin/delete-provider?email=provider@example.com
 */
export async function DELETE(request: Request) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

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
