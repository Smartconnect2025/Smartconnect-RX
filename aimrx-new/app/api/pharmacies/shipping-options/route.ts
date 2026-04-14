import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

const DEFAULT_OPTIONS = [
  { id: "standard_overnight", label: "Standard Overnight", price_cents: 4000 },
  { id: "refrigerated_overnight", label: "Refrigerated Overnight", price_cents: 5500 },
];

export async function GET(request: NextRequest) {
  try {
    const pharmacyId = request.nextUrl.searchParams.get("pharmacyId");
    if (!pharmacyId) {
      return NextResponse.json({ success: true, options: DEFAULT_OPTIONS });
    }

    const supabase = createAdminClient();
    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("id, name")
      .eq("id", pharmacyId)
      .single();

    if (!pharmacy) {
      return NextResponse.json({ success: true, options: DEFAULT_OPTIONS });
    }

    return NextResponse.json({ success: true, options: DEFAULT_OPTIONS });
  } catch {
    return NextResponse.json({ success: true, options: DEFAULT_OPTIONS });
  }
}
