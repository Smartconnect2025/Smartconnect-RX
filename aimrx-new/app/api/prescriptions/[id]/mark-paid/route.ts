import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: prescriptionId } = await params;
    const supabaseAdmin = createAdminClient();

    let body: { prescriptionIds?: string[]; suppressPatientNotifications?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // no body is fine for single-prescription mark-paid
    }

    let explicitIds: string[] =
      Array.isArray(body.prescriptionIds) && body.prescriptionIds.length > 0
        ? body.prescriptionIds
        : [prescriptionId];

    if (!explicitIds.includes(prescriptionId)) {
      explicitIds.unshift(prescriptionId);
    }

    const { data: primaryRx } = await supabaseAdmin
      .from("prescriptions")
      .select("pharmacy_id")
      .eq("id", prescriptionId)
      .single();

    if (explicitIds.length === 1) {
      try {
        const { data: probe } = await (supabaseAdmin.from("prescriptions") as any)
          .select("order_group_id")
          .eq("id", prescriptionId)
          .single();
        const groupId = probe?.order_group_id;
        if (groupId) {
          const { data: groupRxs } = await (supabaseAdmin.from("prescriptions") as any)
            .select("id")
            .eq("order_group_id", groupId);
          if (groupRxs && groupRxs.length > 1) {
            explicitIds = groupRxs.map((rx: any) => rx.id);
          }
        }
      } catch {
      }
    }

    const { data: rxList, error: rxFetchError } = await supabaseAdmin
      .from("prescriptions")
      .select(
        "id, prescriber_id, status, payment_status, payment_transaction_id, patient_id, patient_price, profit_cents, shipping_fee_cents, total_paid_cents, pharmacy_id, medication",
      )
      .in("id", explicitIds);

    if (rxFetchError || !rxList || rxList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Prescriptions not found" },
        { status: 404 },
      );
    }

    if (rxList.length !== explicitIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more prescription IDs are invalid" },
        { status: 400 },
      );
    }

    const isAdmin = userRole && ["admin", "super_admin"].includes(userRole);
    const firstPatientId = rxList[0].patient_id;

    if (isAdmin && userRole === "admin") {
      const { data: pharmacyAdmin } = await supabaseAdmin
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .single();

      for (const rx of rxList) {
        if (pharmacyAdmin && pharmacyAdmin.pharmacy_id !== rx.pharmacy_id) {
          return NextResponse.json(
            { success: false, error: "Access denied — prescription not assigned to your pharmacy" },
            { status: 403 },
          );
        }
      }
    }

    for (const rx of rxList) {
      if (!isAdmin && rx.prescriber_id !== user.id) {
        return NextResponse.json(
          { success: false, error: `Forbidden: you do not own prescription ${rx.id}` },
          { status: 403 },
        );
      }
      if (rx.patient_id !== firstPatientId) {
        return NextResponse.json(
          { success: false, error: "All prescriptions must belong to the same patient" },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const allRxIds = rxList.map((rx) => rx.id);

    const combinedMedCents = rxList.reduce((sum, rx) => {
      const p = rx.patient_price ? parseFloat(rx.patient_price) : 0;
      return sum + (Number.isFinite(p) ? Math.round(p * 100) : 0);
    }, 0);
    const combinedProfitCents = rxList.reduce((sum, rx) => sum + (rx.profit_cents || 0), 0);
    const combinedShippingCents = rxList.reduce((sum, rx) => sum + (rx.shipping_fee_cents || 0), 0);
    const combinedTotal = combinedMedCents + combinedProfitCents + combinedShippingCents;

    const existingTxId = rxList.find((rx) => rx.payment_transaction_id)?.payment_transaction_id;
    let paymentTransactionId: string;

    if (existingTxId) {
      const { error: ptError } = await supabaseAdmin
        .from("payment_transactions")
        .update({
          payment_status: "completed",
          order_progress: "payment_received",
          paid_at: now,
          card_type: "manual-payment",
          updated_at: now,
          total_amount_cents: combinedTotal,
          medication_cost_cents: combinedMedCents,
          consultation_fee_cents: combinedProfitCents,
          shipping_fee_cents: combinedShippingCents,
        })
        .eq("id", existingTxId);

      if (ptError) {
        console.error("Error updating payment_transaction:", ptError);
        return NextResponse.json(
          { success: false, error: "Failed to update payment transaction" },
          { status: 500 },
        );
      }
      paymentTransactionId = existingTxId;
    } else {
      const { data: newTransaction, error: createError } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          prescription_id: prescriptionId,
          payment_status: "completed",
          order_progress: "payment_received",
          paid_at: now,
          card_type: "manual-payment",
          total_amount_cents: combinedTotal,
          medication_cost_cents: combinedMedCents,
          consultation_fee_cents: combinedProfitCents,
          shipping_fee_cents: combinedShippingCents,
          payment_token: `manual-${crypto.randomUUID()}`,
          patient_id: rxList[0].patient_id,
        })
        .select("id")
        .single();

      if (createError || !newTransaction) {
        console.error("Error creating payment_transaction:", createError);
        return NextResponse.json(
          { success: false, error: "Failed to create payment transaction" },
          { status: 500 },
        );
      }
      paymentTransactionId = newTransaction.id;
    }

    // Idempotency: skip Rx already paid
    const rxIdsToUpdate = allRxIds.filter((id) => {
      const rx = rxList.find((r) => r.id === id);
      return rx && rx.payment_status !== "paid";
    });

    if (rxIdsToUpdate.length > 0) {
      const { error: rxError } = await supabaseAdmin
        .from("prescriptions")
        .update({
          payment_status: "paid",
          order_progress: "payment_received",
          status: "payment_received",
          payment_transaction_id: paymentTransactionId,
          updated_at: now,
        })
        .in("id", rxIdsToUpdate);

      if (rxError) {
        console.error("Error updating prescriptions:", rxError);
        return NextResponse.json(
          { success: false, error: "Failed to update prescriptions" },
          { status: 500 },
        );
      }
    }

    // Link any remaining Rx that were already paid but not linked
    const alreadyPaidIds = allRxIds.filter((id) => !rxIdsToUpdate.includes(id));
    for (const id of alreadyPaidIds) {
      const rx = rxList.find((r) => r.id === id);
      if (rx && !rx.payment_transaction_id) {
        await supabaseAdmin
          .from("prescriptions")
          .update({ payment_transaction_id: paymentTransactionId })
          .eq("id", id);
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    let anySubmitFailed = false;

    for (const rxId of allRxIds) {
      try {
        const submitResponse = await fetch(
          `${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret,
            },
          }
        );

        if (!submitResponse.ok) {
          console.error(`[mark-paid] Failed to submit ${rxId} to pharmacy`);
          anySubmitFailed = true;
        } else {
          console.log(`[mark-paid] Prescription ${rxId} submitted to pharmacy`);
        }
      } catch (submitError) {
        console.error(`[mark-paid] Error submitting ${rxId}:`, submitError);
        anySubmitFailed = true;
      }
    }

    if (anySubmitFailed) {
      try {
        await supabaseAdmin.from("system_logs").insert({
          user_id: user.id,
          user_email: user.email || "unknown",
          user_name: "System",
          action: "PHARMACY_SUBMISSION_FAILED",
          details: `Some prescriptions in order ${paymentTransactionId} failed to submit to pharmacy after mark-paid. Manual submission may be required.`,
          status: "error",
        });
      } catch (_) {}
    }

    // Send confirmation email (skipped when notifications are suppressed,
    // e.g. pay-on-terms auto-bypass — the patient gets no receipt/email/SMS).
    let emailSent = false;
    const primaryRxPatient = rxList[0];
    if (!body.suppressPatientNotifications) try {
      const { data: patientData } = await supabaseAdmin
        .from("patients")
        .select("email, first_name, last_name")
        .eq("id", primaryRxPatient.patient_id)
        .single();

      if (patientData?.email) {
        const { data: provider } = await supabaseAdmin
          .from("providers")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .single();

        const { data: pharmacy } = primaryRx?.pharmacy_id
          ? await supabaseAdmin
              .from("pharmacies")
              .select("name")
              .eq("id", primaryRx.pharmacy_id)
              .single()
          : { data: null };

        const internalApiKey = process.env.INTERNAL_API_KEY || "";

        const medNames = rxList.map((rx) => rx.medication || "Prescription medication");
        const medications = rxList.map((rx) => {
          const item: { name: string; price?: string; shippingFee?: string } = {
            name: rx.medication || "Prescription medication",
          };
          if (rx.patient_price != null) item.price = parseFloat(String(rx.patient_price)).toFixed(2);
          if ((rx.shipping_fee_cents ?? 0) > 0) item.shippingFee = ((rx.shipping_fee_cents ?? 0) / 100).toFixed(2);
          return item;
        });
        const totalOversightDollars = (combinedProfitCents / 100).toFixed(2);

        await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": internalApiKey,
          },
          body: JSON.stringify({
            patientEmail: patientData.email,
            patientName: `${patientData.first_name} ${patientData.last_name}`,
            providerName: provider ? `${provider.first_name} ${provider.last_name}` : "Your Provider",
            medication: medNames.join(", "),
            medications,
            oversightFee: parseFloat(totalOversightDollars) > 0 ? totalOversightDollars : undefined,
            totalAmount: (combinedTotal / 100).toFixed(2),
            paymentMethod: "Manual Payment",
            pharmacyName: pharmacy?.name,
            prescriptionId,
          }),
        });
        emailSent = true;
      }
    } catch (emailErr) {
      console.error("[mark-paid] Email error:", emailErr instanceof Error ? emailErr.message : "Unknown");
    }

    if (anySubmitFailed) {
      return NextResponse.json({
        success: true,
        updatedIds: allRxIds,
        emailSent,
        warning: "Marked as paid but some prescriptions failed to submit to pharmacy.",
      });
    }

    return NextResponse.json({
      success: true,
      updatedIds: allRxIds,
      emailSent,
      message: allRxIds.length > 1
        ? `${allRxIds.length} prescriptions marked as paid and submitted to pharmacy`
        : "Prescription marked as paid and submitted to pharmacy",
    });
  } catch (error) {
    console.error("Unexpected error marking prescription as paid:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
