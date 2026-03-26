import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse, requireAnyAdmin } from "@core/auth/api-guards";

const ALLOWED_FIELDS = new Set([
  "first_name",
  "last_name",
  "phone_number",
  "company_name",
  "group_id",
  "is_active",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  try {
    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const body = await request.json();

    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        sanitized[key] = body[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    if (sanitized.group_id === "") {
      sanitized.group_id = null;
    }

    const supabase = createAdminClient();

    if (adminCheck.pharmacyScope?.isPharmacyAdmin && adminCheck.pharmacyScope.pharmacyId) {
      const scopePharmacyId = adminCheck.pharmacyScope.pharmacyId;
      const { data: link } = await supabase
        .from("provider_pharmacy_links")
        .select("id")
        .eq("provider_id", id)
        .eq("pharmacy_id", scopePharmacyId)
        .maybeSingle();

      if (!link) {
        return NextResponse.json(
          { error: "Provider not found within your pharmacy" },
          { status: 403 },
        );
      }
    }

    const { error } = await supabase
      .from("providers")
      .update(sanitized)
      .eq("id", id);

    if (error) {
      console.error("Error updating provider:", error);
      return NextResponse.json(
        { error: "Failed to update provider" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating provider:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
