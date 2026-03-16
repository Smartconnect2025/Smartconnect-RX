import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

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

    const { data: pharmacies, error } = await supabaseAdmin
      .from("pharmacies")
      .select("id, name, slug")
      .order("name");

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
