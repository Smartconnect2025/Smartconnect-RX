import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { getPharmacyAdminScope } from "@core/auth/api-guards";

export async function GET() {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();
    const scope = await getPharmacyAdminScope(user.id);

    let query = supabase
      .from("pharmacies")
      .select("id, name, slug, is_active, created_at")
      .order("name");

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json(
          { success: false, error: "Pharmacy admin has no linked pharmacy" },
          { status: 403 }
        );
      }
      query = query.eq("id", scope.pharmacyId);
    }

    const { data: pharmacies, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const pharmaciesWithCounts = await Promise.all(
      (pharmacies || []).map(async (pharmacy) => {
        const { data: medications } = await supabase
          .from("pharmacy_medications")
          .select("id")
          .eq("pharmacy_id", pharmacy.id);

        return {
          ...pharmacy,
          medication_count: medications?.length || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      pharmacies: pharmaciesWithCounts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
