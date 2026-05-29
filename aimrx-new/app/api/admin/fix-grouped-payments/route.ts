import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

export async function POST() {
  try {
    const { user, userRole } = await getUser();
    if (!user || (userRole !== "admin" && userRole !== "super_admin" && userRole !== "provider")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: allPaidRxs } = await supabase
      .from("prescriptions")
      .select("id, order_group_id, payment_status, status, payment_transaction_id")
      .not("order_group_id", "is", null)
      .in("payment_status", ["paid"])
      .not("order_group_id", "eq", "");

    if (!allPaidRxs || allPaidRxs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No paid grouped prescriptions found",
        fixed: 0,
      });
    }

    const paidGroupIds = [...new Set(allPaidRxs.map(rx => rx.order_group_id).filter(Boolean))];

    let totalFixed = 0;
    const fixedDetails: Array<{ groupId: string; prescriptionId: string; medication?: string; oldStatus: string; oldPaymentStatus: string }> = [];

    for (const groupId of paidGroupIds) {
      const paidRx = allPaidRxs.find(rx => rx.order_group_id === groupId && rx.payment_transaction_id);
      const txId = paidRx?.payment_transaction_id;

      const { data: stuckRxs } = await supabase
        .from("prescriptions")
        .select("id, medication, status, payment_status, payment_transaction_id")
        .eq("order_group_id", groupId)
        .neq("payment_status", "paid");

      if (!stuckRxs || stuckRxs.length === 0) continue;

      for (const stuck of stuckRxs) {
        const updateData: Record<string, string> = {
          payment_status: "paid",
          status: "payment_received",
          updated_at: new Date().toISOString(),
        };

        if (txId) {
          updateData.payment_transaction_id = txId;
        }

        const { error: updateError } = await supabase
          .from("prescriptions")
          .update(updateData)
          .eq("id", stuck.id);

        if (!updateError) {
          totalFixed++;
          fixedDetails.push({
            groupId: groupId!,
            prescriptionId: stuck.id,
            medication: stuck.medication,
            oldStatus: stuck.status,
            oldPaymentStatus: stuck.payment_status || "null",
          });
        } else {
          console.error(`Failed to fix prescription ${stuck.id}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${totalFixed} prescriptions across ${paidGroupIds.length} groups`,
      fixed: totalFixed,
      groupsChecked: paidGroupIds.length,
      details: fixedDetails,
    });
  } catch (error) {
    console.error("[fix-grouped-payments] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix grouped payments" },
      { status: 500 }
    );
  }
}
