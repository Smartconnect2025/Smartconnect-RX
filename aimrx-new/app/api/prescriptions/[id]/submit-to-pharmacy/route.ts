import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getPrescriptionPdfBase64 } from "@core/services/storage/prescriptionPdfStorage";
import { isEncrypted, decryptApiKey } from "@core/security/encryption";
import { getUser } from "@/core/auth/get-user";
import { resolvePharmacyBackendAny, type ResolvedPharmacyBackend } from "../../_shared/pharmacy-dispatcher";
import { submitPioneerRxEScript } from "../../_shared/pioneerrx-helpers";

const DEFAULT_DIGITALRX_BASE_URL =
  process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
  "https://www.dbswebserver.com/DBSRestApi/API";
const VENDOR_NAME = process.env.NEXT_PUBLIC_VENDOR_NAME || "SmartRx Demo";

async function submitToDigitalRx(
  backend: ResolvedPharmacyBackend,
  prescription: Record<string, unknown>,
  patient: Record<string, unknown>,
  provider: Record<string, unknown>,
  pharmacyMedication: Record<string, unknown> | null,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
) {
  let apiUrl = backend.baseUrl || DEFAULT_DIGITALRX_BASE_URL;
  apiUrl = apiUrl
    .replace(/^https?\/\/:/, "https://")
    .replace(/^https?:\/\/:/, "https://")
    .replace(/^https?\/\/\/+/, "https://");

  const rxNumber = `RX${Date.now()}`;
  const dateWritten = new Date().toISOString().split("T")[0];

  const customAddr = (prescription as Record<string, unknown>).custom_address as { street?: string; city?: string; state?: string; zipCode?: string; zip?: string } | null;
  const hasValidCustomAddress = (prescription as Record<string, unknown>).has_custom_address
    && customAddr
    && customAddr.street
    && customAddr.city
    && customAddr.state
    && (customAddr.zipCode || customAddr.zip);
  const patientAddress = hasValidCustomAddress
    ? customAddr
    : (patient as Record<string, unknown>)?.physical_address as Record<string, string> | undefined;

  const patients = (prescription as Record<string, unknown>).patients as Record<string, unknown> | null;
  if (!patients) {
    return { success: false as const, error: "Patient data not found for this prescription", status: 400 };
  }
  const patientGender = (patients?.data as Record<string, unknown>)?.gender;
  const patientSex = typeof patientGender === "string"
    ? (patientGender.toLowerCase() === "male" ? "M" : patientGender.toLowerCase() === "female" ? "F" : "U")
    : "U";

  const digitalRxPayload = {
    StoreID: backend.storeId,
    VendorName: VENDOR_NAME,
    Patient: {
      FirstName: patients.first_name || "",
      LastName: patients.last_name || "",
      DOB: patients.date_of_birth || "",
      Sex: patientSex,
      PatientStreet: patientAddress?.street,
      PatientCity: patientAddress?.city,
      PatientState: patientAddress?.state,
      PatientZip: patientAddress?.zipCode || patientAddress?.zip,
      PatientPhone: (patient as Record<string, unknown>).phone,
      Email: (patient as Record<string, unknown>).email,
    },
    Doctor: {
      DoctorFirstName: (provider as Record<string, unknown>).first_name,
      DoctorLastName: (provider as Record<string, unknown>).last_name,
      DoctorNpi: (provider as Record<string, unknown>).npi_number,
      DoctorDea: (provider as Record<string, unknown>).dea_number,
      DoctorStreet: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.street,
      DoctorCity: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.city,
      DoctorState: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.state,
      DoctorZip: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.zipCode
        || ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.zip,
      DoctorPhone: (provider as Record<string, unknown>).phone_number,
    },
    RxClaim: {
      RxNumber: rxNumber,
      DrugName: (prescription as Record<string, unknown>).medication,
      Qty: String((prescription as Record<string, unknown>).quantity),
      DateWritten: dateWritten,
      RequestedBy: `${(provider as Record<string, unknown>).first_name} ${(provider as Record<string, unknown>).last_name}`,
      Refills: String((prescription as Record<string, unknown>).refills),
      DrugNDC: (pharmacyMedication as Record<string, unknown>)?.ndc,
      Instructions: (prescription as Record<string, unknown>).sig || (pharmacyMedication as Record<string, unknown>)?.dosage_instructions,
      Notes: (prescription as Record<string, unknown>).pharmacy_notes || (pharmacyMedication as Record<string, unknown>)?.notes,
      Daw: (prescription as Record<string, unknown>).dispense_as_written ? "Y" : "N",
    },
    DocSignature: (provider as Record<string, unknown>).signature_url,
    PDFFile: (prescription as Record<string, unknown>).pdf_storage_path
      ? (
          await getPrescriptionPdfBase64(
            supabaseAdmin,
            (prescription as Record<string, unknown>).pdf_storage_path as string,
          )
        ).base64 || null
      : null,
  };

  console.log("📦 [submit-to-pharmacy] DigitalRx payload:", JSON.stringify({
    StoreID: digitalRxPayload.StoreID,
    VendorName: digitalRxPayload.VendorName,
    Patient: { ...digitalRxPayload.Patient, Email: "***" },
    Doctor: digitalRxPayload.Doctor,
    RxClaim: digitalRxPayload.RxClaim,
    hasDocSignature: !!digitalRxPayload.DocSignature,
    hasPDFFile: !!digitalRxPayload.PDFFile,
  }, null, 2));

  const digitalRxResponse = await fetch(
    `${apiUrl}/RxWebRequest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: backend.apiKey,
      },
      body: JSON.stringify(digitalRxPayload),
    },
  );

  if (!digitalRxResponse.ok) {
    const errorText = await digitalRxResponse.text().catch(() => "Unknown error");
    let detailMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detailMessage = parsed.Message || parsed.message || parsed.error || errorText;
    } catch { /* keep raw text */ }
    return { success: false as const, error: `DigitalRx rejected the submission: ${detailMessage}`, status: digitalRxResponse.status };
  }

  const digitalRxData = await digitalRxResponse.json();
  const queueId = digitalRxData.QueueID || digitalRxData.queueId || digitalRxData.ID;

  if (!queueId) {
    return { success: false as const, error: "DigitalRx did not return a QueueID", status: 500 };
  }

  return { success: true as const, queueId, rxNumber, systemLabel: "DigitalRx" };
}

async function submitToPioneerRx(
  backend: ResolvedPharmacyBackend,
  prescription: Record<string, unknown>,
  patient: Record<string, unknown>,
  provider: Record<string, unknown>,
  pharmacyMedication: Record<string, unknown> | null,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
) {
  const rxNumber = `RX${Date.now()}`;
  const patients = (prescription as Record<string, unknown>).patients as Record<string, unknown> | null;
  if (!patients) {
    return { success: false as const, error: "Patient data not found for this prescription", status: 400 };
  }
  const patientGender = (patients?.data as Record<string, unknown>)?.gender;
  const gender = typeof patientGender === "string"
    ? (patientGender.toLowerCase() === "male" ? "M" : patientGender.toLowerCase() === "female" ? "F" : "U")
    : "U";

  const customAddr = prescription.custom_address as { street?: string; city?: string; state?: string; zipCode?: string; zip?: string } | null;
  const hasValidCustomAddress = prescription.has_custom_address
    && customAddr
    && customAddr.street
    && customAddr.city
    && customAddr.state
    && (customAddr.zipCode || customAddr.zip);
  const patientAddress = hasValidCustomAddress
    ? customAddr
    : (patient as Record<string, unknown>)?.physical_address as Record<string, string> | undefined;

  let pdfBase64: string | null = null;
  if (prescription.pdf_storage_path) {
    const pdfResult = await getPrescriptionPdfBase64(
      supabaseAdmin,
      prescription.pdf_storage_path as string,
    );
    pdfBase64 = pdfResult.base64 || null;
  }

  const result = await submitPioneerRxEScript(
    {
      apiKey: backend.apiKey,
      sharedSecret: backend.sharedSecret,
      baseUrl: backend.baseUrl,
      storeId: backend.storeId,
      locationId: backend.locationId,
    },
    {
      patient: {
        firstName: patients.first_name as string,
        lastName: patients.last_name as string,
        dateOfBirth: patients.date_of_birth as string,
        gender,
        street: patientAddress?.street,
        city: patientAddress?.city,
        state: patientAddress?.state,
        zip: patientAddress?.zipCode || patientAddress?.zip,
        phone: (patient as Record<string, unknown>).phone as string,
        email: (patient as Record<string, unknown>).email as string,
      },
      prescriber: {
        firstName: (provider as Record<string, unknown>).first_name as string,
        lastName: (provider as Record<string, unknown>).last_name as string,
        npi: (provider as Record<string, unknown>).npi_number as string,
        dea: (provider as Record<string, unknown>).dea_number as string,
        street: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.street,
        city: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.city,
        state: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.state,
        zip: ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.zipCode
          || ((provider as Record<string, unknown>).physical_address as Record<string, string>)?.zip,
        phone: (provider as Record<string, unknown>).phone_number as string,
      },
      medication: {
        drugName: prescription.medication as string,
        ndc: (pharmacyMedication as Record<string, unknown>)?.ndc as string,
        quantity: String(prescription.quantity),
        refills: String(prescription.refills),
        sig: (prescription.sig as string) || (pharmacyMedication as Record<string, unknown>)?.dosage_instructions as string || "",
        dispenseAsWritten: !!prescription.dispense_as_written,
        notes: (prescription.pharmacy_notes as string) || (pharmacyMedication as Record<string, unknown>)?.notes as string,
      },
      rxNumber,
      pdfBase64,
      signatureUrl: (provider as Record<string, unknown>).signature_url as string,
    },
  );

  if (!result.success) {
    return { success: false as const, error: result.error, status: 502 };
  }

  return {
    success: true as const,
    queueId: result.data.rxTransactionID,
    rxNumber,
    systemLabel: "PioneerRx",
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: prescriptionId } = await params;

    const internalSecret = request.headers.get("x-internal-secret");
    const configuredSecret = process.env.INTERNAL_API_SECRET;
    let isInternalCall = false;

    if (configuredSecret && internalSecret && internalSecret === configuredSecret) {
      isInternalCall = true;
    } else if (!configuredSecret && internalSecret) {
      console.error("⚠️ [submit-to-pharmacy] INTERNAL_API_SECRET not configured — rejecting internal call. Set INTERNAL_API_SECRET env var.");
    }

    let authenticatedUserId: string | null = null;
    let authenticatedUserRole: string | null = null;

    if (!isInternalCall) {
      const { user, userRole } = await getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      authenticatedUserId = user.id;
      authenticatedUserRole = userRole;
    }

    const supabaseAdmin = createAdminClient();

    const { data: prescription, error: prescriptionError } = await supabaseAdmin
      .from("prescriptions")
      .select(`*, patients (*)`)
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      console.error("❌ Prescription not found:", prescriptionId, "Error:", prescriptionError);
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (!isInternalCall && authenticatedUserId) {
      const isAdmin = authenticatedUserRole && ["admin", "super_admin", "pharmacy_admin"].includes(authenticatedUserRole);
      const isPrescriber = prescription.prescriber_id === authenticatedUserId;
      if (!isAdmin && !isPrescriber) {
        console.error("❌ [submit-to-pharmacy] User", authenticatedUserId, "not authorized for prescription", prescriptionId);
        return NextResponse.json(
          { success: false, error: "You are not authorized to submit this prescription" },
          { status: 403 },
        );
      }
    }

    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("user_id", prescription.prescriber_id)
      .single();

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("id", prescription.patient_id)
      .single();

    let pharmacyMedication = null;
    if (prescription.medication_id) {
      const { data: medData, error: medError } = await supabaseAdmin
        .from("pharmacy_medications")
        .select("*")
        .eq("id", prescription.medication_id)
        .single();

      if (medError) {
        console.error("⚠️ [submit-to-pharmacy] Could not fetch pharmacy medication:", medError);
      } else {
        pharmacyMedication = medData;
      }
    }

    if (providerError || !provider) {
      console.error("❌ Provider not found for prescriber_id:", prescription.prescriber_id, "Error:", providerError);
      return NextResponse.json(
        { success: false, error: "Provider not found" },
        { status: 404 },
      );
    }

    if (prescription.status === "submitted" && prescription.queue_id) {
      return NextResponse.json(
        {
          success: true,
          message: "Prescription already submitted",
          queue_id: prescription.queue_id,
        },
        { status: 200 },
      );
    }

    if (prescription.payment_status !== "paid") {
      console.error("❌ Payment not completed for prescription:", prescriptionId);
      return NextResponse.json(
        { success: false, error: "Payment not completed" },
        { status: 400 },
      );
    }

    const backend = await resolvePharmacyBackendAny(supabaseAdmin, prescription.pharmacy_id);

    if (!backend) {
      console.error("❌ [submit-to-pharmacy] Pharmacy backend not configured for pharmacy_id:", prescription.pharmacy_id);
      return NextResponse.json(
        { success: false, error: "Pharmacy backend not configured" },
        { status: 400 },
      );
    }

    const criticalErrors: string[] = [];
    if (!backend.storeId && backend.systemType === "DigitalRx") criticalErrors.push("StoreID missing — pharmacy backend not configured");
    const rxPatients = prescription.patients as Record<string, unknown> | null;
    if (!rxPatients) criticalErrors.push("Patient record missing");
    else {
      if (!rxPatients.first_name) criticalErrors.push("Patient FirstName missing");
      if (!rxPatients.last_name) criticalErrors.push("Patient LastName missing");
    }
    if (!prescription.medication) criticalErrors.push("DrugName missing");

    if (criticalErrors.length > 0) {
      console.error("❌ [submit-to-pharmacy] Critical validation failed:", criticalErrors);
      return NextResponse.json(
        { success: false, error: `Missing critical fields: ${criticalErrors.join(", ")}`, details: criticalErrors },
        { status: 400 },
      );
    }

    console.log(`📦 [submit-to-pharmacy] Submitting to ${backend.systemType} for pharmacy ${prescription.pharmacy_id}`);

    let result;
    if (backend.systemType === "PioneerRx") {
      result = await submitToPioneerRx(backend, prescription, patient, provider, pharmacyMedication, supabaseAdmin);
    } else {
      result = await submitToDigitalRx(backend, prescription, patient, provider, pharmacyMedication, supabaseAdmin);
    }

    if (!result.success) {
      console.error(`❌ [submit-to-pharmacy] ${backend.systemType} submission failed:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        queue_id: result.queueId,
        status: "submitted",
        rx_number: result.rxNumber,
        order_progress: "pharmacy_processing",
        submitted_to_pharmacy_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    if (updateError) {
      console.error("❌ Error updating prescription:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update prescription" },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("system_logs").insert({
      user_id: prescription.prescriber_id,
      user_email: provider.email || "unknown@example.com",
      user_name: `Dr. ${provider.first_name} ${provider.last_name}`,
      action: "PRESCRIPTION_SUBMITTED_AFTER_PAYMENT",
      details: `${result.systemLabel}: ${prescription.medication} for ${prescription.patients.first_name} ${prescription.patients.last_name}`,
      queue_id: result.queueId,
      status: "success",
    });

    return NextResponse.json(
      {
        success: true,
        message: `Prescription submitted to pharmacy (${result.systemLabel}) successfully`,
        queue_id: result.queueId,
        system_type: result.systemLabel,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ [submit-to-pharmacy] Unexpected error:", error);
    console.error("❌ [submit-to-pharmacy] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
