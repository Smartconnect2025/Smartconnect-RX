import { NextResponse, NextRequest } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    const userRole = roleRow?.role || null;

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    let pharmacyId: string | null = null;

    const { data: adminLink, error: adminLinkError } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminLinkError) {
      console.error("Error checking pharmacy admin scope:", adminLinkError);
      return NextResponse.json({ error: "Failed to verify pharmacy scope" }, { status: 500 });
    }

    const isSuperAdmin = !adminLink;

    if (isSuperAdmin) {
      const queryPharmacyId = request.nextUrl.searchParams.get("pharmacyId");
      if (queryPharmacyId) {
        pharmacyId = queryPharmacyId;
      }
    } else if (adminLink?.pharmacy_id) {
      pharmacyId = adminLink.pharmacy_id;
    } else {
      return NextResponse.json({ error: "No pharmacy assigned to your account" }, { status: 403 });
    }

    const baseSelect = `
      id, queue_id, submitted_at, submitted_to_pharmacy_at, medication, dosage, quantity,
      refills, sig, status, payment_status, patient_price,
      shipping_fee_cents, profit_cents, tracking_number, fedex_status,
      estimated_delivery, tracking_carrier, has_custom_address, custom_address,
      payment_transaction_id, prescriber_id, pharmacy_id, patient_id,
      patient:patients(first_name, last_name, email, physical_address),
      pharmacy:pharmacies(name, primary_color)
    `;

    let query = supabase
      .from("prescriptions")
      .select(baseSelect)
      .neq("status", "cancelled")
      .order("submitted_at", { ascending: false });

    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: prescriptionsData, error: prescriptionsError } = await query;

    if (prescriptionsError) {
      console.error("Error loading prescriptions:", prescriptionsError);
      return NextResponse.json({ error: prescriptionsError.message }, { status: 500 });
    }

    let orderGroupMap = new Map<string, string>();
    try {
      const { data: groupData } = await (supabase.from("prescriptions") as any)
        .select("id, order_group_id")
        .not("order_group_id", "is", null);
      if (groupData) {
        for (const row of groupData) {
          if (row.order_group_id) orderGroupMap.set(row.id, row.order_group_id);
        }
      }
    } catch {
    }

    const prescriberIds = [
      ...new Set((prescriptionsData || []).map((rx) => rx.prescriber_id)),
    ].filter(Boolean);

    let providerMap = new Map<string, { first_name: string; last_name: string }>();

    if (prescriberIds.length > 0) {
      const { data: providersData } = await supabase
        .from("providers")
        .select("user_id, first_name, last_name")
        .in("user_id", prescriberIds);

      providerMap = new Map(
        providersData?.map((p) => [p.user_id, p]) || []
      );
    }

    const testLastNames = ["harton"];

    const { data: paymentTxData } = await supabase
      .from("payment_transactions")
      .select("id, payment_token")
      .in(
        "id",
        (prescriptionsData || [])
          .map((rx) => rx.payment_transaction_id)
          .filter(Boolean),
      );
    const paymentTxMap = new Map(
      (paymentTxData || []).map((pt) => [pt.id, pt]),
    );

    const formatted = (prescriptionsData || [])
      .filter((rx) => {
        const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
        const lastName = (patient as Record<string, unknown>)?.last_name as string;
        if (lastName && testLastNames.includes(lastName.toLowerCase())) return false;
        return true;
      })
      .map((rx) => {
      const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
      const provider = providerMap.get(rx.prescriber_id);
      const pharmacy = Array.isArray(rx.pharmacy) ? rx.pharmacy[0] : rx.pharmacy;
      const paymentTx = rx.payment_transaction_id
        ? paymentTxMap.get(rx.payment_transaction_id)
        : null;

      return {
        id: rx.id,
        queueId: rx.queue_id || "N/A",
        submittedAt: rx.submitted_at,
        sentToPharmacyAt: rx.submitted_to_pharmacy_at || null,
        providerName: provider
          ? `Dr. ${provider.first_name} ${provider.last_name}`
          : "Unknown Provider",
        patientName: patient
          ? `${(patient as { first_name: string; last_name: string }).first_name} ${(patient as { first_name: string; last_name: string }).last_name}`
          : "Unknown Patient",
        patientEmail: (patient as Record<string, unknown>)?.email || null,
        medication: rx.medication,
        strength: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        sig: rx.sig,
        status: rx.status || "submitted",
        paymentStatus: rx.payment_status,
        patientPrice: rx.patient_price,
        shippingFeeCents: rx.shipping_fee_cents,
        profitCents: rx.profit_cents || 0,
        submissionGroupId: orderGroupMap.get(rx.id) || null,
        trackingNumber: rx.tracking_number,
        pharmacyName: (pharmacy as { name?: string })?.name,
        pharmacyColor: (pharmacy as { primary_color?: string })?.primary_color,
        carrierStatus: rx.fedex_status,
        trackingCarrier: rx.tracking_carrier,
        estimatedDelivery: rx.estimated_delivery,
        patientId: rx.patient_id,
        hasCustomAddress: rx.has_custom_address,
        customAddress: rx.custom_address,
        patientAddress: (patient as Record<string, unknown>)?.physical_address || null,
        paymentToken: paymentTx?.payment_token || null,
        paymentTransactionId: rx.payment_transaction_id || null,
      };
    });

    return NextResponse.json({ prescriptions: formatted });
  } catch (error) {
    console.error("Error in admin prescriptions API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
