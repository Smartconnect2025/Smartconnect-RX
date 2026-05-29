import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

/**
 * GET /api/auth/me
 * Returns the current user and their role.
 *
 * Self-healing: if this user is a provider or active delegate (Provider
 * Assistant) and is missing their `providers` row, we backfill it here.
 * This covers delegates that were approved before the auto-provisioning
 * code in /api/admin/delegations/[id]/approve was added.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null, role: null });
  }

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role, is_demo")
    .eq("user_id", user.id)
    .single();

  // Self-heal a missing providers row for delegates approved before the
  // auto-provisioning code was added. We only do this for delegates,
  // because regular providers are created with their providers row.
  if (userRole?.role === "delegate") {
    try {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) {
        const { data: delegation } = await admin
          .from("delegations")
          .select(
            "delegate_first_name, delegate_last_name, delegate_email, delegate_phone",
          )
          .eq("delegate_user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        if (delegation) {
          await admin.from("providers").upsert(
            {
              user_id: user.id,
              first_name: delegation.delegate_first_name,
              last_name: delegation.delegate_last_name,
              email: delegation.delegate_email,
              phone_number: delegation.delegate_phone,
              is_active: true,
            },
            { onConflict: "user_id", ignoreDuplicates: false },
          );
        }
      }
    } catch (err) {
      console.error("[auth/me] delegate self-heal failed:", err);
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    role: userRole?.role || null,
    isDemo: userRole?.is_demo || false,
  });
}
