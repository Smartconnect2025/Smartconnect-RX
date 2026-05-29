import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * Delegate-only profile completeness check.
 *
 * GET /api/delegate/profile-check
 *   → { complete: boolean, missing: string[] }
 *
 * Used by the assistant's portal to decide whether to show the
 * "complete your profile to activate your account" banner.
 *
 * Intentionally separate from /api/provider/profile-check so the shared
 * provider check is not modified.
 */

function hasAllFields(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return ["street", "city", "state", "zipCode", "country"].every(
    (k) => typeof a[k] === "string" && (a[k] as string).trim().length > 0,
  );
}

export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "delegate") {
    return NextResponse.json(
      { error: "Delegate access required" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("delegate_profiles")
    .select("physical_address, billing_address")
    .eq("delegate_user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to check profile", details: error.message },
      { status: 500 },
    );
  }

  const missing: string[] = [];
  if (!hasAllFields(data?.physical_address)) missing.push("physical_address");
  if (!hasAllFields(data?.billing_address)) missing.push("billing_address");

  return NextResponse.json({
    complete: missing.length === 0,
    missing,
  });
}
