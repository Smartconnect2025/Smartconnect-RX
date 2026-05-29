import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * POST /api/delegate/change-password
 * Body: { currentPassword: string, newPassword: string }
 *
 * Forced first-login password change for assistants. Verifies the current
 * (temp) password by attempting a transient sign-in (does NOT touch the
 * caller's session), then updates the password and clears
 * user_metadata.must_change_password so middleware stops redirecting.
 */
function isStrongPassword(s: string): { ok: true } | { ok: false; reason: string } {
  if (s.length < 10) {
    return { ok: false, reason: "Password must be at least 10 characters." };
  }
  const hasUpper = /[A-Z]/.test(s);
  const hasLower = /[a-z]/.test(s);
  const hasDigit = /\d/.test(s);
  const hasSymbol = /[^A-Za-z0-9]/.test(s);
  const classes = [hasUpper, hasLower, hasDigit, hasSymbol].filter(
    Boolean,
  ).length;
  if (classes < 3) {
    return {
      ok: false,
      reason:
        "Password must include at least 3 of: uppercase, lowercase, digit, symbol.",
    };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user || !user.email) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  // Open to delegate for now (Phase 2). Could open to other roles later.
  if (userRole !== "delegate") {
    return NextResponse.json(
      { error: "Delegate access required" },
      { status: 403 },
    );
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Both current and new password are required" },
      { status: 400 },
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different from the current one" },
      { status: 400 },
    );
  }
  const strength = isStrongPassword(newPassword);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason }, { status: 400 });
  }

  // Re-verify current password via a transient client (no session touch).
  const { createClient } = await import("@supabase/supabase-js");
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyErr } = await anonClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  await anonClient.auth.signOut().catch(() => {});

  if (verifyErr) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 },
    );
  }

  // Update password + clear the must_change_password flag. We re-read existing
  // metadata via the admin client because the cached/serialized user from
  // getUser() does not include user_metadata.
  const supabase = createAdminClient();
  const { data: fullUser, error: getErr } =
    await supabase.auth.admin.getUserById(user.id);
  if (getErr || !fullUser?.user) {
    return NextResponse.json(
      {
        error: "Failed to load user record",
        details: getErr?.message ?? "not found",
      },
      { status: 500 },
    );
  }
  const existingMeta = (fullUser.user.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const newMeta = { ...existingMeta, must_change_password: false };

  const { error: updateErr } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      password: newPassword,
      user_metadata: newMeta,
    },
  );

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to update password", details: updateErr.message },
      { status: 500 },
    );
  }

  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "DELEGATE_PASSWORD_CHANGED",
      details: `First-login password change for delegate ${user.email}`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    success: true,
    message: "Password updated.",
  });
}
