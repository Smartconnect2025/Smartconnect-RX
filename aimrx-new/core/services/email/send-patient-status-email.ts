import { createAdminClient } from "@core/database/client";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://smartconnect-rx.onrender.com";

interface PatientStatusEmailParams {
  prescriptionId: string;
  newStatus: string;
  trackingNumber?: string | null;
}

const STATUS_TO_EMAIL_TYPE: Record<string, string> = {
  packed: "pharmacy_processing",
  processing: "pharmacy_processing",
  approved: "pharmacy_processing",
  submitted: "",
  picked_up: "shipped",
  shipped: "shipped",
  delivered: "delivered",
  ready_for_pickup: "ready_for_pickup",
};

export async function sendPatientStatusEmail(params: PatientStatusEmailParams): Promise<void> {
  const statusType = STATUS_TO_EMAIL_TYPE[params.newStatus];
  if (!statusType) return;
  if (!INTERNAL_API_KEY) {
    console.warn("[send-patient-status-email] INTERNAL_API_KEY not set, skipping");
    return;
  }

  try {
    const supabase = createAdminClient();

    const { data: rx } = await supabase
      .from("prescriptions")
      .select(`
        id, medication, queue_id, pharmacy_id, tracking_number,
        patient_id, prescriber_id,
        patients(first_name, last_name, email)
      `)
      .eq("id", params.prescriptionId)
      .single();

    if (!rx) {
      console.warn("[send-patient-status-email] Prescription not found:", params.prescriptionId);
      return;
    }

    const patient = rx.patients as { first_name?: string; last_name?: string; email?: string } | null;
    if (!patient?.email) {
      console.log("[send-patient-status-email] No patient email, skipping");
      return;
    }

    let providerName = "Your Provider";
    if (rx.prescriber_id) {
      const { data: prov } = await supabase
        .from("providers")
        .select("first_name, last_name")
        .eq("id", rx.prescriber_id)
        .maybeSingle();
      if (prov) {
        providerName = `Dr. ${prov.first_name || ""} ${prov.last_name || ""}`.trim();
      }
    }

    const patientName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "there";

    let pharmacyName = "";
    let pharmacyPhone = "";
    let pharmacyAddress = "";
    if (rx.pharmacy_id) {
      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("name, phone, address")
        .eq("id", rx.pharmacy_id)
        .single();

      if (pharmacy) {
        pharmacyName = pharmacy.name || "";
        pharmacyPhone = pharmacy.phone || "";
        pharmacyAddress = pharmacy.address || "";
      }
    }

    const trackingNumber = params.trackingNumber || rx.tracking_number || "";
    const trackingUrl = trackingNumber
      ? `https://parcelsapp.com/en/tracking/${trackingNumber}`
      : "";

    const emailPayload = {
      patientEmail: patient.email,
      patientName,
      medication: rx.medication || "your medication",
      providerName,
      statusType,
      trackingNumber,
      trackingUrl,
      pharmacyName,
      pharmacyPhone,
      pharmacyAddress,
      prescriptionId: params.prescriptionId,
    };

    const response = await fetch(`${SITE_URL}/api/payments/send-status-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[send-patient-status-email] Failed:", response.status, text);
    } else {
      console.log(`[send-patient-status-email] Status email '${statusType}' sent for prescription ${params.prescriptionId}`);
    }
  } catch (err) {
    console.error("[send-patient-status-email] Error:", err);
  }
}
