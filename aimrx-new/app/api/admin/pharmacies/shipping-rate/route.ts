import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/core/supabase/server";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import pg from "pg";

function getPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10000,
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const scope = await getPharmacyAdminScope(user.id);
    const isAdmin = userRole && ["admin", "super_admin"].includes(userRole.role);

    if (!isAdmin && !scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const pharmacyId = request.nextUrl.searchParams.get("pharmacyId");
    if (!pharmacyId) {
      return NextResponse.json(
        { success: false, error: "pharmacyId is required" },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pharmacyId)) {
      return NextResponse.json(
        { success: false, error: "Invalid pharmacy ID" },
        { status: 400 }
      );
    }

    if (scope.isPharmacyAdmin && scope.pharmacyId !== pharmacyId) {
      return NextResponse.json(
        { success: false, error: "You can only view your own pharmacy" },
        { status: 403 }
      );
    }

    const pool = getPool();
    try {
      const result = await pool.query(
        "SELECT default_shipping_rate_cents FROM pharmacies WHERE id = $1",
        [pharmacyId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Pharmacy not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        default_shipping_rate_cents: result.rows[0].default_shipping_rate_cents ?? 0,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Error fetching shipping rate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shipping rate" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const scope = await getPharmacyAdminScope(user.id);
    const isAdmin = userRole && ["admin", "super_admin"].includes(userRole.role);

    if (!isAdmin && !scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pharmacyId, default_shipping_rate_cents } = body;

    if (!pharmacyId) {
      return NextResponse.json(
        { success: false, error: "pharmacyId is required" },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pharmacyId)) {
      return NextResponse.json(
        { success: false, error: "Invalid pharmacy ID" },
        { status: 400 }
      );
    }

    const rate = default_shipping_rate_cents;
    if (typeof rate !== "number" || !Number.isInteger(rate) || rate < 0 || rate > 100000) {
      return NextResponse.json(
        { success: false, error: "Shipping rate must be a whole number between 0 and 100000 cents ($0-$1000)" },
        { status: 400 }
      );
    }

    if (scope.isPharmacyAdmin && !scope.pharmacyId) {
      return NextResponse.json(
        { success: false, error: "Pharmacy admin scope could not be determined" },
        { status: 403 }
      );
    }
    if (scope.isPharmacyAdmin && scope.pharmacyId !== pharmacyId) {
      return NextResponse.json(
        { success: false, error: "You can only update your own pharmacy" },
        { status: 403 }
      );
    }

    const pool = getPool();
    try {
      const result = await pool.query(
        "UPDATE pharmacies SET default_shipping_rate_cents = $1, updated_at = now() WHERE id = $2 RETURNING id",
        [rate, pharmacyId]
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { success: false, error: "Pharmacy not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, message: "Shipping rate saved" });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Error saving shipping rate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save shipping rate" },
      { status: 500 }
    );
  }
}
