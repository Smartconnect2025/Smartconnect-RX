import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

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

    // Try to include shipping_fee_cents. If the column doesn't exist yet on
    // this database (e.g. migration hasn't run), fall back to selecting the
    // base columns so the page still loads — shipping fee will default to
    // 2500 cents in the UI.
    const baseCols =
      "id, name, slug, is_active, created_at, phone, address, contact_email, notification_emails, npi, dea_number, ncpdp_number, logo_url, primary_color, tagline";

    let pharmacies: Array<Record<string, unknown>> | null = null;
    let firstError: { code?: string; message: string } | null = null;
    {
      const { data, error } = await supabase
        .from("pharmacies")
        .select(`${baseCols}, shipping_fee_cents`)
        .order("name");
      if (error) {
        firstError = { code: error.code, message: error.message };
      } else {
        pharmacies = data;
      }
    }

    if (!pharmacies) {
      console.warn(
        "pharmacies/list: shipping_fee_cents query failed, falling back without it. Error:",
        firstError,
      );
      const { data, error } = await supabase
        .from("pharmacies")
        .select(baseCols)
        .order("name");
      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      pharmacies = (data || []).map((p) => ({
        ...p,
        shipping_fee_cents: 2500,
      }));
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
