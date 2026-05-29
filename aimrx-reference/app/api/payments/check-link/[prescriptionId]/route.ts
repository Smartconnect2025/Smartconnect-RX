import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

/**
 * GET /api/payments/status/[prescriptionId]
 * Check if a payment link exists for a prescription
 * Returns existing link info if found, or null if no link exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ prescriptionId: string }> }
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (userRole !== "provider" && userRole !== "delegate") {
      return NextResponse.json(
        { error: "Provider access required" },
        { status: 403 }
      );
    }

    const { prescriptionId } = await params;

    const supabase = createAdminClient();

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("id, prescriber_id, payment_status")
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to view this prescription" },
        { status: 403 }
      );
    }

    if (prescription.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        hasExistingLink: false,
        isPaid: true,
      });
    }

    let existingPayments = null;

    {
      const { data } = await supabase
        .from("payment_transactions")
        .select(
          "id, payment_link_url, payment_token, payment_link_expires_at, total_amount_cents, consultation_fee_cents, medication_cost_cents, shipping_fee_cents, description, patient_email"
        )
        .eq("prescription_id", prescriptionId)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      existingPayments = data;
    }

    if (!existingPayments?.length && prescription.payment_status !== "paid") {
      const { data: rxWithTx } = await supabase
        .from("prescriptions")
        .select("payment_transaction_id, order_group_id")
        .eq("id", prescriptionId)
        .single();

      if (rxWithTx?.payment_transaction_id) {
        const { data: linkedTx } = await supabase
          .from("payment_transactions")
          .select(
            "id, payment_link_url, payment_token, payment_link_expires_at, total_amount_cents, consultation_fee_cents, medication_cost_cents, shipping_fee_cents, description, patient_email"
          )
          .eq("id", rxWithTx.payment_transaction_id)
          .eq("payment_status", "pending")
          .limit(1);
        if (linkedTx?.length) {
          existingPayments = linkedTx;
        }
      }

      if (!existingPayments?.length && rxWithTx?.order_group_id) {
        const { data: groupTxs } = await supabase
          .from("prescriptions")
          .select("payment_transaction_id")
          .eq("order_group_id", rxWithTx.order_group_id)
          .not("payment_transaction_id", "is", null);

        if (groupTxs && groupTxs.length > 0) {
          const txIds = [...new Set(groupTxs.map(r => r.payment_transaction_id).filter(Boolean))];
          if (txIds.length > 0) {
            const { data: activeTxs } = await supabase
              .from("payment_transactions")
              .select(
                "id, payment_link_url, payment_token, payment_link_expires_at, total_amount_cents, consultation_fee_cents, medication_cost_cents, shipping_fee_cents, description, patient_email"
              )
              .in("id", txIds)
              .eq("payment_status", "pending")
              .order("created_at", { ascending: false })
              .limit(1);
            if (activeTxs?.length) {
              existingPayments = activeTxs;
            }
          }
        }
      }
    }

    const existingPayment = existingPayments?.[0] || null;

    if (!existingPayment) {
      return NextResponse.json({
        success: true,
        hasExistingLink: false,
        isPaid: false,
      });
    }

    // Time-based expiration removed (Joseph rule, May 11 2026 — Jessica
    // Carroll incident). Payment links never expire; an existing pending
    // row is always returned to the caller as a live link. Rows only
    // leave the active path through explicit admin action (regenerate,
    // delete-by-provider, refund, processor "no match" terminal).

    // Return existing link info
    return NextResponse.json({
      success: true,
      hasExistingLink: true,
      isPaid: false,
      existingLink: {
        paymentUrl: existingPayment.payment_link_url,
        paymentToken: existingPayment.payment_token,
        expiresAt: existingPayment.payment_link_expires_at,
        totalAmountCents: existingPayment.total_amount_cents,
        consultationFeeCents: existingPayment.consultation_fee_cents,
        medicationCostCents: existingPayment.medication_cost_cents,
        shippingFeeCents: existingPayment.shipping_fee_cents,
        description: existingPayment.description,
        patientEmail: existingPayment.patient_email,
      },
    });
  } catch (error) {
    console.error("[PAYMENT:status] Error:", error);
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/check-link/[prescriptionId]
 * Delete a pending payment link for a prescription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ prescriptionId: string }> }
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (userRole !== "provider" && userRole !== "delegate") {
      return NextResponse.json(
        { error: "Provider access required" },
        { status: 403 }
      );
    }

    const { prescriptionId } = await params;

    const supabase = createAdminClient();

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("id, prescriber_id, payment_status")
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to modify this prescription" },
        { status: 403 }
      );
    }

    if (prescription.payment_status === "paid") {
      return NextResponse.json(
        { error: "Cannot delete a payment link for a paid prescription" },
        { status: 400 }
      );
    }

    const { data: txToDelete } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("payment_status", "pending")
      .eq("prescription_id", prescriptionId);

    let txIdsToDelete: string[] = txToDelete?.map(t => t.id) || [];

    if (txIdsToDelete.length === 0) {
      const { data: rxWithTx } = await supabase
        .from("prescriptions")
        .select("payment_transaction_id, order_group_id")
        .eq("id", prescriptionId)
        .single();

      if (rxWithTx?.payment_transaction_id) {
        const { data: linkedTx } = await supabase
          .from("payment_transactions")
          .select("id")
          .eq("id", rxWithTx.payment_transaction_id)
          .eq("payment_status", "pending");
        if (linkedTx?.length) {
          txIdsToDelete = linkedTx.map(t => t.id);
        }
      }

      if (txIdsToDelete.length === 0 && rxWithTx?.order_group_id) {
        const { data: groupTxs } = await supabase
          .from("prescriptions")
          .select("payment_transaction_id")
          .eq("order_group_id", rxWithTx.order_group_id)
          .not("payment_transaction_id", "is", null);

        if (groupTxs && groupTxs.length > 0) {
          const txIds = [...new Set(groupTxs.map(r => r.payment_transaction_id).filter(Boolean))];
          if (txIds.length > 0) {
            const { data: activeTxs } = await supabase
              .from("payment_transactions")
              .select("id")
              .in("id", txIds)
              .eq("payment_status", "pending");
            if (activeTxs?.length) {
              txIdsToDelete = activeTxs.map(t => t.id);
            }
          }
        }
      }
    }

    if (txIdsToDelete.length > 0) {
      await supabase
        .from("prescriptions")
        .update({ payment_transaction_id: null, payment_status: "pending" })
        .in("payment_transaction_id", txIdsToDelete);

      // Soft-mark expired instead of physically deleting. Preserves the
      // forensic record (provider, amount, timing, gateway breadcrumbs)
      // that was destroyed by the original DELETE during the Apr 22-23
      // incident, while still removing the link from the active path.
      // The .eq("payment_status", "pending") guard ensures we never flip
      // a row that has since transitioned to processing/completed.
      const { error: softMarkError } = await supabase
        .from("payment_transactions")
        .update({
          payment_status: "expired",
          reconciliation_note: "link_deleted_by_provider",
          updated_at: new Date().toISOString(),
        })
        .in("id", txIdsToDelete)
        .eq("payment_status", "pending");

      if (softMarkError) {
        console.error("[PAYMENT:delete] Error:", softMarkError);
        return NextResponse.json(
          { error: "Failed to delete payment link" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PAYMENT:delete] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment link" },
      { status: 500 }
    );
  }
}
