import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { requireNonDemo, createGuardErrorResponse, getPharmacyAdminScope } from "@core/auth/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const isSuperAdmin = userRole === "super_admin";

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (scope.isPharmacyAdmin) {
        return NextResponse.json(
          { error: "This action is restricted to platform administrators" },
          { status: 403 },
        );
      }
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { name, email, pharmacy_ids } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const { id } = await params;

    const { data: platformManager, error } = await supabase
      .from("platform_managers")
      .update({ name, email: email || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Platform manager not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to update platform manager. Please try again." },
        { status: 500 },
      );
    }

    if (pharmacy_ids !== undefined && Array.isArray(pharmacy_ids)) {
      const { data: previousLinks } = await supabase
        .from("platform_manager_pharmacies")
        .select("platform_manager_id, pharmacy_id")
        .eq("platform_manager_id", id);

      const { error: deleteError } = await supabase
        .from("platform_manager_pharmacies")
        .delete()
        .eq("platform_manager_id", id);

      if (deleteError) {
        console.error("Error clearing pharmacy links:", deleteError);
        return NextResponse.json(
          { error: "Failed to update pharmacy associations." },
          { status: 500 },
        );
      }

      if (pharmacy_ids.length > 0) {
        const links = pharmacy_ids.map((pharmacyId: string) => ({
          platform_manager_id: id,
          pharmacy_id: pharmacyId,
        }));

        const { error: linkError } = await supabase
          .from("platform_manager_pharmacies")
          .insert(links);

        if (linkError) {
          console.error("Error inserting pharmacy links:", linkError);
          if (previousLinks && previousLinks.length > 0) {
            await supabase
              .from("platform_manager_pharmacies")
              .insert(previousLinks.map((l) => ({
                platform_manager_id: l.platform_manager_id,
                pharmacy_id: l.pharmacy_id,
              })));
          }
          return NextResponse.json(
            { error: "Failed to update pharmacy associations." },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      platformManager,
      message: "Platform manager updated successfully",
    });
  } catch (error) {
    console.error("Error updating platform manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const isSuperAdmin = userRole === "super_admin";

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (scope.isPharmacyAdmin) {
        return NextResponse.json(
          { error: "This action is restricted to platform administrators" },
          { status: 403 },
        );
      }
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const supabase = await createServerClient();
    const { id } = await params;

    const { error: fetchError } = await supabase
      .from("platform_managers")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Platform manager not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to delete platform manager. Please try again." },
        { status: 500 },
      );
    }

    const { error } = await supabase
      .from("platform_managers")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete platform manager. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Platform manager deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting platform manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
