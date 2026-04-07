import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase";
import { createAdminClient } from "@core/database/client";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, is_demo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
      return NextResponse.json(
        { error: "Failed to determine user role" },
        { status: 500 }
      );
    }

    if (!roleRow || !["admin", "super_admin"].includes(roleRow.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { data: pharmacyAdminData, error: pharmError } = await supabaseAdmin
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (pharmError) {
      console.error("Error fetching pharmacy admin scope:", pharmError);
      return NextResponse.json(
        { error: "Failed to determine pharmacy scope" },
        { status: 500 }
      );
    }

    const isSuperAdmin = roleRow.role === "super_admin" || (roleRow.role === "admin" && !pharmacyAdminData);
    const isPharmacyAdmin = roleRow.role === "admin" && !!pharmacyAdminData;

    let pharmacyName: string | null = null;
    if (isPharmacyAdmin && pharmacyAdminData?.pharmacy_id) {
      const { data: pharmacy } = await supabaseAdmin
        .from("pharmacies")
        .select("name")
        .eq("id", pharmacyAdminData.pharmacy_id)
        .single();
      pharmacyName = pharmacy?.name || null;
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      isSuperAdmin,
      isPharmacyAdmin,
      pharmacyId: pharmacyAdminData?.pharmacy_id || null,
      pharmacyName,
      isDemo: roleRow.is_demo || false,
    });
  } catch (error) {
    console.error("Error in admin scope check:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
