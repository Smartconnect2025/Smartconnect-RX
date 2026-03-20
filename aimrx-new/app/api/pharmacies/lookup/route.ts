import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Missing slug parameter" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: pharmacy, error } = await supabaseAdmin
      .from("pharmacies")
      .select("id, name, slug")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !pharmacy) {
      return NextResponse.json(
        { success: false, error: "Pharmacy not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        slug: pharmacy.slug,
      },
    });
  } catch (error) {
    console.error("Error looking up pharmacy:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
