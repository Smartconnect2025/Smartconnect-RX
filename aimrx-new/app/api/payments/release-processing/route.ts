import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { CHARGE_IN_FLIGHT_MS } from "@/app/api/payments/_lib/constants";

/**
 * POST /api/payments/release-processing
 * Revert a payment_transactions row from "processing" back to "pending"
 * when an inline (in-modal) hosted-form session is canceled or abandoned
 * before completion. Requires staff authentication.
 *
 * This is needed because /api/payments/get-hosted-token claims the row
 * (sets it to "processing") to prevent double-charge, but the inline
 * flow can be aborted client-side without the server learning about it.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    if (
      userRole !== "provider" &&
      userRole !== "delegate" &&
      userRole !== "admin" &&
      userRole !== "super_admin"
    ) {
      return NextResponse.json(
        { success: false, error: "Provider or admin access required" },
        { status: 403 },
      );
    }

    const { paymentToken } = await request.json();
    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Forensic-safe release: read the row first so we can apply
    // ownership and in-flight checks. Without these, ANY authenticated
    // staff member with a payment_token (which is an unguessable random
    // string but still leakable via support tooling, logs, or browser
    // history) could release another provider's processing lock and
    // open a re-lease window — a real cross-tenant double-charge
    // primitive. We also refuse to release a row that is mid-charge
    // (charge_attempt_started_at within CHARGE_IN_FLIGHT_MS), because
    // doing so would let a second hosted-form token be issued while
    // Authorize.Net is still talking to the first one.
    const { data: row, error: readErr } = await supabase
      .from("payment_transactions")
      .select(
        "id, provider_id, payment_status, charge_attempt_started_at",
      )
      .eq("payment_token", paymentToken)
      .single();

    if (readErr || !row) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    const isPrivileged = userRole === "admin" || userRole === "super_admin";
    if (!isPrivileged) {
      // Map the auth user back to a provider row to compare ids.
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!provider || row.provider_id !== provider.id) {
        return NextResponse.json(
          {
            success: false,
            error: "You do not have permission to release this payment.",
            code: "NOT_OWNER",
          },
          { status: 403 },
        );
      }
    }

    if (
      row.charge_attempt_started_at &&
      Date.now() -
          new Date(row.charge_attempt_started_at).getTime() <
        CHARGE_IN_FLIGHT_MS
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A charge is in flight for this payment and cannot be released right now.",
          code: "CHARGE_IN_FLIGHT",
        },
        { status: 409 },
      );
    }

    // Only flip processing → pending. Never touch completed/failed rows.
    const { data, error } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("payment_status", "processing")
      .select("id");

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to release lock" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      released: !!(data && data.length > 0),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to release lock" },
      { status: 500 },
    );
  }
}
