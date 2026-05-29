import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import sgMail from "@sendgrid/mail";

/**
 * POST /api/admin/delegations/[id]/approve
 *
 * Body: { password: string }
 *
 * On approve:
 *   1. Validate the delegation is still 'pending_admin'
 *   2. Create the assistant's auth.users account with the supplied temp password
 *   3. Insert user_roles row with role='delegate'
 *   4. Update delegation: status='pending_delegate', delegate_user_id, admin fields
 *   5. Send welcome email with credentials
 *
 * The delegation does NOT become 'active' until the assistant signs the
 * acknowledgment on her first login (Phase 2).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const { id: delegationId } = await params;
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // 1. Load delegation + ensure pending_admin AND provider is still valid
  const { data: delegation, error: loadErr } = await supabase
    .from("delegations")
    .select(
      `
      id, status, delegate_first_name, delegate_last_name, delegate_email,
      delegate_phone, delegate_title, provider_id,
      providers:provider_id ( prefix, first_name, last_name, npi_number, is_active, user_id )
    `,
    )
    .eq("id", delegationId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json(
      { error: "Failed to load delegation", details: loadErr.message },
      { status: 500 },
    );
  }
  if (!delegation) {
    return NextResponse.json(
      { error: "Delegation not found" },
      { status: 404 },
    );
  }
  if (delegation.status !== "pending_admin") {
    return NextResponse.json(
      {
        error: `Delegation is not awaiting admin approval (status: ${delegation.status})`,
      },
      { status: 409 },
    );
  }

  // Re-validate the provider at approval time. A provider could have been
  // deactivated, unlinked, or had their NPI removed since the delegation
  // request was submitted.
  const providerRow = Array.isArray(delegation.providers)
    ? delegation.providers[0]
    : (delegation.providers as {
        first_name?: string | null;
        last_name?: string | null;
        npi_number?: string | null;
        is_active?: boolean | null;
        user_id?: string | null;
      } | null);

  if (!providerRow) {
    return NextResponse.json(
      { error: "Authorizing provider not found" },
      { status: 409 },
    );
  }
  if (providerRow.is_active === false) {
    return NextResponse.json(
      {
        error:
          "Authorizing provider is currently inactive. Reactivate the provider before approving this delegation.",
      },
      { status: 409 },
    );
  }
  if (!providerRow.user_id) {
    return NextResponse.json(
      {
        error:
          "Authorizing provider is not linked to a user account. Link the provider before approving this delegation.",
      },
      { status: 409 },
    );
  }
  if (!providerRow.npi_number) {
    return NextResponse.json(
      {
        error:
          "Authorizing provider has no NPI on file. Update the provider's profile before approving this delegation.",
      },
      { status: 409 },
    );
  }

  // 2. Create assistant's auth.users account
  const { data: authUser, error: authError } =
    await supabase.auth.admin.createUser({
      email: delegation.delegate_email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: delegation.delegate_first_name,
        last_name: delegation.delegate_last_name,
        role: "delegate",
        // Forces the new assistant to change her temp password on first
        // login. Cleared by /api/delegate/change-password after a successful
        // change. Middleware reads this from auth.getUser() and redirects
        // to /auth/change-password until it is gone.
        must_change_password: true,
      },
    });

  if (authError || !authUser?.user) {
    const isDuplicate =
      authError?.code === "user_already_exists" ||
      authError?.code === "email_exists" ||
      authError?.message?.toLowerCase().includes("already") ||
      authError?.message?.toLowerCase().includes("exists");

    return NextResponse.json(
      {
        error: isDuplicate
          ? "A user with this email already exists. Use a different email or contact support to link the existing account."
          : authError?.message || "Failed to create assistant account",
      },
      { status: isDuplicate ? 400 : 500 },
    );
  }

  const newUserId = authUser.user.id;

  // 3. Insert user_roles row
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: newUserId,
    role: "delegate",
  });

  if (roleError) {
    // Roll back the auth user
    await supabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      {
        error: "Failed to assign delegate role",
        details: roleError.message,
      },
      { status: 500 },
    );
  }

  // 4. Atomic state transition via Postgres RPC. The function takes a row
  // lock, re-validates BOTH the delegation status AND the provider's
  // is_active/user_id/npi fields inside a single transaction. This closes
  // the TOCTOU window between the validation done above and the final
  // status flip — a concurrent provider deactivation cannot slip through.
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "approve_delegation_atomic",
    {
      p_delegation_id: delegationId,
      p_admin_user_id: user.id,
      p_delegate_user_id: newUserId,
    },
  );

  const rollback = async () => {
    await supabase.from("user_roles").delete().eq("user_id", newUserId);
    await supabase.auth.admin.deleteUser(newUserId);
  };

  if (rpcError) {
    await rollback();
    return NextResponse.json(
      { error: "Failed to update delegation", details: rpcError.message },
      { status: 500 },
    );
  }

  const result = rpcResult as { ok?: boolean; reason?: string } | null;
  if (!result || !result.ok) {
    await rollback();
    const reason = result?.reason ?? "unknown";
    const userMessage: Record<string, string> = {
      not_found: "Delegation no longer exists.",
      wrong_status:
        "Delegation status changed during approval (likely actioned by another admin). Refresh and try again.",
      provider_missing: "Authorizing provider no longer exists.",
      provider_inactive:
        "Authorizing provider was deactivated during approval. Reactivate the provider and retry.",
      provider_unlinked:
        "Authorizing provider was unlinked from a user account during approval.",
      provider_no_npi:
        "Authorizing provider's NPI was removed during approval.",
    };
    return NextResponse.json(
      { error: userMessage[reason] ?? `Approval rejected: ${reason}` },
      { status: 409 },
    );
  }

  // 4b. Provision a `providers` row for the assistant.
  //
  // Provider Assistance — simple model: the assistant uses the regular
  // provider terminal as her own account. She therefore needs her own
  // `providers` row keyed by user_id, so the terminal queries that join
  // providers find her.
  //
  //   - npi_number / dea_number / signature_url / medical_licenses are
  //     intentionally NULL: those belong to the AUTHORIZING provider, not
  //     the assistant. The submit endpoint stamps the authorizing
  //     provider's NPI on the outgoing prescription.
  //   - company_name is NULL initially. The admin assigns the assistant
  //     to a clinic via the dropdown in the Provider Assistance page,
  //     which then triggers the existing clinic-sharing function so the
  //     assistant immediately sees every patient in the clinic.
  //   - is_active = true so the active check (which validates the
  //     authorizing provider's status, not the assistant's) works.
  // Prefix is hard-coded to "PA" for every provider assistant (rule
  // established May 14 2026, Joseph: "when we create provider assistance
  // she should always be PA"). The assistant did not write the script and
  // does not carry the supervising doctor's title — she is a Provider
  // Assistant, full stop. The supervising doctor's "Dr." prefix is
  // stamped onto the Electronic Rx PDF independently from the authorizing
  // provider's row, so this assignment never affects what pharmacies see.
  const { error: provisionError } = await supabase.from("providers").upsert(
    {
      user_id: newUserId,
      first_name: delegation.delegate_first_name,
      last_name: delegation.delegate_last_name,
      email: delegation.delegate_email,
      phone_number: delegation.delegate_phone,
      prefix: "PA",
      is_active: true,
    },
    { onConflict: "user_id", ignoreDuplicates: false },
  );
  if (provisionError) {
    // FATAL: an assistant without a providers row cannot use the terminal
    // (no patient panel, no submit-refill, no clinic assignment). The
    // delegation has already advanced to `pending_delegate` via the RPC,
    // so we surface a clear error rather than silently leaving the admin
    // with a broken record. The admin can retry this provisioning step
    // by re-running approve (the upsert is idempotent on user_id) or by
    // manually creating the row from the providers admin page.
    console.error(
      "[delegations approve] provider provisioning failed:",
      provisionError,
    );
    return NextResponse.json(
      {
        error:
          "Account was created but the assistant's provider profile could not be provisioned. The welcome email was NOT sent. The delegation has already advanced and cannot be re-approved — please create a providers row for this user from the Providers admin page (using their email below), then resend credentials.",
        details: provisionError.message,
        userId: newUserId,
        userEmail: delegation.delegate_email,
        emailSent: false,
      },
      { status: 500 },
    );
  }

  // 5. Send welcome email. We track success/failure honestly: the API
  // response surfaces emailSent + emailError so the UI can warn the admin
  // and show the temp password for manual delivery if the send did not go
  // through. Email failures do NOT roll back the approval — the account
  // exists and the admin can resend, but they MUST be told.
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {
      emailError = "SENDGRID_API_KEY is not configured";
    } else if (sendGridApiKey) {
      sgMail.setApiKey(sendGridApiKey);

      const providerName = providerRow
        ? `${(providerRow as { prefix?: string | null }).prefix || "Dr."} ${providerRow.first_name ?? ""} ${providerRow.last_name ?? ""}`.trim()
        : "your authorizing provider";

      const appUrl = "https://app.aimrx.com/auth/login";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 80px; margin-bottom: 15px;" />
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to AIM RX Portal</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; line-height: 1.6;">
              Hello ${delegation.delegate_first_name},
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              Your AimRx Provider Assistance account has been approved.
              You have been authorized by <strong>${providerName}</strong>
              to act as <strong>${delegation.delegate_title}</strong>
              on his behalf.
            </p>
            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Your Login Credentials</h2>
              <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${appUrl}" style="color: #00AEEF;">${appUrl}</a></p>
              <p style="margin: 10px 0;"><strong>Username (Email):</strong> ${delegation.delegate_email}</p>
              <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px;">${password}</code></p>
            </div>
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400E;">
                <strong>⚠️ First-time login:</strong> You will be required to change your temporary password,
                set up multi-factor authentication, and review and sign your authorization acknowledgment
                before you can begin using the portal.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}" style="display: inline-block; background: #1E3A8A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Log In to Portal
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
              Questions? Contact <a href="mailto:support@aimrx.com" style="color: #00AEEF;">support@aimrx.com</a>.
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            © ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.
          </div>
        </div>
      `;

      await sgMail.send({
        to: delegation.delegate_email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
          name: process.env.SENDGRID_FROM_NAME || "AIM RX Portal",
        },
        subject: "Welcome to AIM RX Portal — Your Provider Assistance Account",
        html,
      });
      emailSent = true;
    }
  } catch (emailErr) {
    emailError =
      emailErr instanceof Error ? emailErr.message : "Unknown send failure";
    console.error("[delegations approve] email send failed:", emailErr);
  }

  // Audit log (non-fatal). Includes email delivery outcome so we can later
  // identify approvals where the welcome email never reached the assistant.
  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_APPROVED",
      details: `Approved delegation ${delegationId} for ${delegation.delegate_email} under provider ${delegation.provider_id}. Welcome email: ${emailSent ? "sent" : `FAILED (${emailError ?? "unknown"})`}`,
      status: emailSent ? "success" : "warning",
    });
  } catch (logErr) {
    console.error("[delegations approve] log error (non-fatal):", logErr);
  }

  return NextResponse.json(
    {
      success: true,
      emailSent,
      emailError,
      // Returned ONLY when the email did not go through, so the admin can
      // relay the credentials to the assistant manually. Never logged on
      // the success path.
      tempPassword: emailSent ? undefined : password,
      delegateEmail: delegation.delegate_email,
      message: emailSent
        ? "Delegation approved. Assistant account created and welcome email sent."
        : "Delegation approved and account created, BUT the welcome email did not send. Please share the temporary password with the assistant manually.",
      delegate_user_id: newUserId,
    },
    { status: 200 },
  );
}
