import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

export async function GET() {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin", "provider"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    const probe = await supabase
      .from("prescriptions")
      .select("order_group_id")
      .limit(0);
    if (probe.error) {
      return NextResponse.json({ success: true, groups: {} });
    }

    let query = supabase
      .from("prescriptions")
      .select("id, order_group_id")
      .not("order_group_id", "is", null);

    if (userRole === "provider") {
      query = query.eq("prescriber_id", user.id);
    } else if (userRole === "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .single();

      if (pharmacyAdmin?.pharmacy_id) {
        query = query.eq("pharmacy_id", pharmacyAdmin.pharmacy_id);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("[submission-groups] Error:", error.message);
      return NextResponse.json(
        { success: false, error: "Failed to fetch groups" },
        { status: 500 },
      );
    }

    const groups: Record<string, string> = {};
    for (const row of data || []) {
      if ((row as Record<string, unknown>).order_group_id) {
        groups[row.id] = (row as Record<string, unknown>).order_group_id as string;
      }
    }

    return NextResponse.json({ success: true, groups });
  } catch (error) {
    console.error("[submission-groups] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
