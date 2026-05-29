import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createAdminClient();

    let groups: Record<string, string> = {};
    try {
      const { data: groupRows } = await supabase
        .from("prescriptions")
        .select("id, order_group_id")
        .not("order_group_id", "is", null);
      if (groupRows) {
        for (const row of groupRows as { id: string; order_group_id: string }[]) {
          groups[row.id] = row.order_group_id;
        }
      }
    } catch {}

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json({ groups: {} });
  }
}
