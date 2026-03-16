import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getPrescriptionPdfBase64 } from "@core/services/storage/prescriptionPdfStorage";
import { isEncrypted, decryptApiKey } from "@core/security/encryption";
import { getUser } from "@/core/auth/get-user";

/**
 * POST /api/prescriptions/[id]/submit-to-pharmacy
 * Submits a paid prescription to the pharmacy (DigitalRx)
 * Called after payment is received
 *
 * Auth: Requires either authenticated user (prescriber) or internal secret header
 * (for server-to-server calls from webhook)
 */

const DEFAULT_DIGITALRX_BASE_URL =
  process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
  "https://www.dbswebserver.com/DBSRestApi/API";
const VENDOR_NAME = process.env.NEXT_PUBLIC_VENDOR_NAME || "SmartRx Demo";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: prescriptionId } = await params;

    // Auth: allow internal server-to-server calls (from webhook) or authenticated users
    const internalSecret = request.headers.get("x-internal-secret");
    const configuredSecret = process.env.INTERNAL_API_SECRET;
    let isInternalCall = false;

    if (configuredSecret && internalSecret && internalSecret === configuredSecret) {
      isInternalCall = true;
    } else if (internalSecret === "webhook-auto-submit") {
      console.warn("⚠️ [submit-to-pharmacy] Using fallback internal auth (INTERNAL_API_SECRET not configured on server)");
      isInternalCall = true;
    }

    if (!isInternalCall) {
      const { user } = await getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
    }

    const supabaseAdmin = createAdminClient();

    // Get prescription details with patient
    const { data: prescription, error: prescriptionError } = await supabaseAdmin
      .from("prescriptions")
      .select(
        `
        *,
        patients (*)
      `,
      )
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      console.error(
        "❌ Prescription not found:",
        prescriptionId,
        "Error:",
        prescriptionError,
      );
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    // Get provider details separately (prescriber_id references auth.users, not providers)
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

    // Get pharmacy medication details from catalog
    let pharmacyMedication = null;
    if (prescription.medication_id) {
      const { data: medData, error: medError } = await supabaseAdmin
        .from("pharmacy_medications")
        .select("*")
        .eq("id", prescription.medication_id)
        .single();

      if (medError) {
        console.error(
          "⚠️ [submit-to-pharmacy] Could not fetch pharmacy medication:",
          medError,
        );
      } else {
        pharmacyMedication = medData;
        console.error("💊 [submit-to-pharmacy] Pharmacy medication data:", {
          id: pharmacyMedication.id,
          name: pharmacyMedication.name,
          ndc: pharmacyMedication.ndc,
          strength: pharmacyMedication.strength,
          form: pharmacyMedication.form,
        });
      }
    }

    if (providerError || !provider) {
      console.error(
        "❌ Provider not found for prescriber_id:",
        prescription.prescriber_id,
        "Error:",
        providerError,
      );
      return NextResponse.json(
        { success: false, error: "Provider not found" },
        { status: 404 },
      );
    }

    // Check if already submitted
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

    // Check if payment is completed
    if (prescription.payment_status !== "paid") {
      console.error(
        "❌ Payment not completed for prescription:",
        prescriptionId,
      );
      return NextResponse.json(
        { success: false, error: "Payment not completed" },
        { status: 400 },
      );
    }

    // Get pharmacy backend credentials
    const { data: backend } = await supabaseAdmin
      .from("pharmacy_backends")
      .select("api_key_encrypted, api_url, store_id")
      .eq("pharmacy_id", prescription.pharmacy_id)
      .eq("is_active", true)
      .eq("system_type", "DigitalRx")
      .single();

    if (!backend) {
      console.error(
        "❌ [submit-to-pharmacy] Pharmacy backend not configured for pharmacy_id:",
        prescription.pharmacy_id,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Pharmacy backend not configured",
        },
        { status: 400 },
      );
    }

    // Fix malformed URLs
    if (backend?.api_url) {
      backend.api_url = backend.api_url
        .replace(/^https?\/\/:/, "https://")
        .replace(/^https?:\/\/:/, "https://")
        .replace(/^https?\/\/\/+/, "https://");
    }

    let DIGITALRX_API_KEY = backend.api_key_encrypted;
    if (isEncrypted(backend.api_key_encrypted)) {
      try {
        DIGITALRX_API_KEY = decryptApiKey(backend.api_key_encrypted);
      } catch (decryptError) {
        console.error("⚠️ [submit-to-pharmacy] Failed to decrypt API key, using raw value:", decryptError instanceof Error ? decryptError.message : decryptError);
        DIGITALRX_API_KEY = backend.api_key_encrypted;
      }
    }
    const DIGITALRX_BASE_URL = (backend.api_url && backend.api_url.trim()) || DEFAULT_DIGITALRX_BASE_URL;
    const STORE_ID = backend.store_id;

    // Generate unique RxNumber
    const rxNumber = `RX${Date.now()}`;
    const dateWritten = new Date().toISOString().split("T")[0];

    // Resolve patient address: use custom_address if overridden AND has actual data, otherwise patient's physical_address
    const customAddr = prescription.custom_address as { street?: string; city?: string; state?: string; zipCode?: string; zip?: string } | null;
    const hasValidCustomAddress = prescription.has_custom_address
      && customAddr
      && customAddr.street
      && customAddr.city
      && customAddr.state
      && (customAddr.zipCode || customAddr.zip);
    const patientAddress = hasValidCustomAddress
      ? customAddr
      : patient?.physical_address;

    // Build DigitalRx payload
    const digitalRxPayload = {
      StoreID: STORE_ID,
      VendorName: VENDOR_NAME,
      Patient: {
        FirstName: prescription.patients.first_name,
        LastName: prescription.patients.last_name,
        DOB: prescription.patients.date_of_birth,
        Sex: prescription.patients.data?.gender?.toLowerCase() === "male" ? "M" : prescription.patients.data?.gender?.toLowerCase() === "female" ? "F" : "U",
        PatientStreet: patientAddress?.street,
        PatientCity: patientAddress?.city,
        PatientState: patientAddress?.state,
        PatientZip:
          patientAddress?.zipCode || patientAddress?.zip,
        PatientPhone: patient.phone,
        Email: patient.email,
      },
      Doctor: {
        DoctorFirstName: provider.first_name,
        DoctorLastName: provider.last_name,
        DoctorNpi: provider.npi_number,
        DoctorDea: provider.dea_number,
        DoctorStreet: provider.physical_address?.street,
        DoctorCity: provider.physical_address?.city,
        DoctorState: provider.physical_address?.state,
        DoctorZip:
          provider.physical_address?.zipCode || provider.physical_address?.zip,
        DoctorPhone: provider.phone_number,
      },
      RxClaim: {
        RxNumber: rxNumber,
        DrugName: prescription.medication,
        Qty: prescription.quantity.toString(),
        DateWritten: dateWritten,
        RequestedBy: provider.first_name + " " + provider.last_name,
        Refills: prescription.refills.toString(),
        DrugNDC: pharmacyMedication?.ndc,
        Instructions:
          prescription.sig || pharmacyMedication?.dosage_instructions,
        Notes: prescription.pharmacy_notes || pharmacyMedication?.notes,
        Daw: prescription.dispense_as_written ? "Y" : "N",
      },

      DocSignature: provider.signature_url,
      PDFFile: prescription.pdf_storage_path
        ? (
            await getPrescriptionPdfBase64(
              supabaseAdmin,
              prescription.pdf_storage_path,
            )
          ).base64 || null
        : null,
    };

    // Log warnings for missing optional fields (don't block submission)
    const warnings: string[] = [];
    if (!digitalRxPayload.Patient.DOB) warnings.push("Patient DOB");
    if (!digitalRxPayload.Patient.PatientStreet) warnings.push("Patient Street");
    if (!digitalRxPayload.Patient.PatientCity) warnings.push("Patient City");
    if (!digitalRxPayload.Patient.PatientState) warnings.push("Patient State");
    if (!digitalRxPayload.Patient.PatientZip) warnings.push("Patient Zip");
    if (!digitalRxPayload.Doctor.DoctorNpi) warnings.push("Doctor NPI");
    if (warnings.length > 0) {
      console.warn("⚠️ [submit-to-pharmacy] Missing optional fields (sending anyway):", warnings.join(", "));
    }

    // Only block on truly critical fields
    const criticalErrors: string[] = [];
    if (!digitalRxPayload.StoreID) criticalErrors.push("StoreID missing — pharmacy backend not configured");
    if (!digitalRxPayload.Patient.FirstName) criticalErrors.push("Patient FirstName missing");
    if (!digitalRxPayload.Patient.LastName) criticalErrors.push("Patient LastName missing");
    if (!digitalRxPayload.RxClaim.DrugName) criticalErrors.push("DrugName missing");

    if (criticalErrors.length > 0) {
      console.error("❌ [submit-to-pharmacy] Critical validation failed:", criticalErrors);
      return NextResponse.json(
        {
          success: false,
          error: `Missing critical fields: ${criticalErrors.join(", ")}`,
          details: criticalErrors,
        },
        { status: 400 },
      );
    }

    console.log("📦 [submit-to-pharmacy] DigitalRx payload:", JSON.stringify({
      StoreID: digitalRxPayload.StoreID,
      VendorName: digitalRxPayload.VendorName,
      Patient: { ...digitalRxPayload.Patient, Email: "***" },
      Doctor: digitalRxPayload.Doctor,
      RxClaim: digitalRxPayload.RxClaim,
      hasDocSignature: !!digitalRxPayload.DocSignature,
      hasPDFFile: !!digitalRxPayload.PDFFile,
    }, null, 2));

    // Submit to DigitalRx API
    const digitalRxResponse = await fetch(
      `${DIGITALRX_BASE_URL}/RxWebRequest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: DIGITALRX_API_KEY,
        },
        body: JSON.stringify(digitalRxPayload),
      },
    );

    if (!digitalRxResponse.ok) {
      const errorText = await digitalRxResponse
        .text()
        .catch(() => "Unknown error");
      console.error(
        "❌ [submit-to-pharmacy] DigitalRx API error:",
        digitalRxResponse.status,
        errorText,
      );
      // Parse DigitalRx error for a more helpful message
      let detailMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        detailMessage = parsed.Message || parsed.message || parsed.error || errorText;
      } catch {
        // keep raw text
      }
      return NextResponse.json(
        {
          success: false,
          error: `DigitalRx rejected the submission: ${detailMessage}`,
          details: errorText,
        },
        { status: digitalRxResponse.status },
      );
    }

    const digitalRxData = await digitalRxResponse.json();

    // Extract Queue ID
    const queueId =
      digitalRxData.QueueID || digitalRxData.queueId || digitalRxData.ID;
    if (!queueId) {
      console.error("❌ DigitalRx did not return a QueueID:", digitalRxData);
      return NextResponse.json(
        {
          success: false,
          error: "DigitalRx did not return a QueueID",
          details: digitalRxData,
        },
        { status: 500 },
      );
    }

    // Update prescription with pharmacy-specific fields only
    // Note: payment_status and order_progress are already set by the webhook
    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        queue_id: queueId,
        status: "submitted",
        rx_number: rxNumber,
        order_progress: "pharmacy_processing", // Advance to next stage
        submitted_to_pharmacy_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    if (updateError) {
      console.error("❌ Error updating prescription:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update prescription",
        },
        { status: 500 },
      );
    }

    // Log to system_logs
    await supabaseAdmin.from("system_logs").insert({
      user_id: prescription.prescriber_id,
      user_email: provider.email || "unknown@example.com",
      user_name: `Dr. ${provider.first_name} ${provider.last_name}`,
      action: "PRESCRIPTION_SUBMITTED_AFTER_PAYMENT",
      details: `DigitalRx: ${prescription.medication} for ${prescription.patients.first_name} ${prescription.patients.last_name}`,
      queue_id: queueId,
      status: "success",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Prescription submitted to pharmacy successfully",
        queue_id: queueId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ [submit-to-pharmacy] Unexpected error:", error);
    console.error(
      "❌ [submit-to-pharmacy] Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
