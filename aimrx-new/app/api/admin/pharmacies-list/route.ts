import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { getPharmacyAdminScope, createGuardErrorResponse } from "@core/auth/api-guards";

export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const scope = await getPharmacyAdminScope(user.id);

    let query = supabaseAdmin
      .from("pharmacies")
      .select("id, name, slug")
      .order("name");

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json({ error: "Pharmacy admin has no linked pharmacy" }, { status: 403 });
      }
      query = query.eq("id", scope.pharmacyId);
    }

    const { data: pharmacies, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch pharmacies" }, { status: 500 });
    }

    return NextResponse.json({ success: true, pharmacies: pharmacies || [] });
  } catch (error) {
    console.error("Error fetching pharmacies:", error);
    return NextResponse.json(
      { error: "Failed to fetch pharmacies" },
      { status: 500 }
    );
  }
}
