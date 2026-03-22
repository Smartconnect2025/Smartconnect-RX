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
    const isSuperAdmin = userRole === "super_admin";

    if (isSuperAdmin) {
      const queryPharmacyId = request.nextUrl.searchParams.get("pharmacyId");
      if (queryPharmacyId) {
        pharmacyId = queryPharmacyId;
      }
    } else {
      const { data: adminLink, error: adminLinkError } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminLinkError) {
        console.error("Error checking pharmacy admin scope:", adminLinkError);
        return NextResponse.json({ error: "Failed to verify pharmacy scope" }, { status: 500 });
      }

      if (adminLink?.pharmacy_id) {
        pharmacyId = adminLink.pharmacy_id;
      } else {
        return NextResponse.json({ error: "No pharmacy assigned to your account" }, { status: 403 });
      }
    }

    let query = supabase
      .from("prescriptions")
      .select(`
        id,
        queue_id,
        submitted_at,
        medication,
        dosage,
        quantity,
        refills,
        sig,
        status,
        payment_status,
        tracking_number,
        prescriber_id,
        pharmacy_id,
        patient:patients(first_name, last_name),
        pharmacy:pharmacies(name, primary_color)
      `)
      .order("submitted_at", { ascending: false });

    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: prescriptionsData, error: prescriptionsError } = await query;

    if (prescriptionsError) {
      console.error("Error loading prescriptions:", prescriptionsError);
      return NextResponse.json({ error: prescriptionsError.message }, { status: 500 });
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

    const formatted = (prescriptionsData || []).map((rx) => {
      const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
      const provider = providerMap.get(rx.prescriber_id);
      const pharmacy = Array.isArray(rx.pharmacy) ? rx.pharmacy[0] : rx.pharmacy;

      return {
        id: rx.id,
        queueId: rx.queue_id || "N/A",
        submittedAt: rx.submitted_at,
        providerName: provider
          ? `Dr. ${provider.first_name} ${provider.last_name}`
          : "Unknown Provider",
        patientName: patient
          ? `${(patient as { first_name: string; last_name: string }).first_name} ${(patient as { first_name: string; last_name: string }).last_name}`
          : "Unknown Patient",
        medication: rx.medication,
        strength: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        sig: rx.sig,
        status: rx.status || "submitted",
        paymentStatus: rx.payment_status,
        trackingNumber: rx.tracking_number,
        pharmacyName: (pharmacy as { name?: string })?.name,
        pharmacyColor: (pharmacy as { primary_color?: string })?.primary_color,
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
