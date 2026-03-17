import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { checkProviderActive } from "@/core/auth/check-provider-active";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

/**
 * Prescription Submission API
 *
 * Submits prescriptions to the pharmacy backend (DigitalRx or PioneerRx)
 * and stores the response in the database.
 * Uses pharmacy-specific credentials from pharmacy_backends table.
 */

import { resolvePharmacyBackendAny } from "./_shared/pharmacy-dispatcher";

const DEFAULT_DIGITALRX_BASE_URL =
  process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
  "https://www.dbswebserver.com/DBSRestApi/API";
const VENDOR_NAME = process.env.NEXT_PUBLIC_VENDOR_NAME || "SmartRx Demo";

interface SubmitPrescriptionRequest {
  prescriber_id: string;
  patient_id: string;
  encounter_id?: string;
  appointment_id?: string;
  medication: string;
  dosage: string; // Legacy field: combined amount+unit (e.g., "10mg")
  dosage_amount?: string; // New structured field: numeric amount (e.g., "10")
  dosage_unit?: string; // New structured field: unit (e.g., "mg")
  vial_size?: string;
  form?: string;
  quantity: number;
  refills: number;
  sig: string;
  dispense_as_written?: boolean;
  pharmacy_notes?: string;
  patient_price?: string;
  pharmacy_id?: string;
  medication_id?: string;
  profit_cents?: number; // Provider oversight/monitoring fees in cents
  consultation_reason?: string; // Reason for the consultation fee
  shipping_fee_cents?: number; // Shipping fee in cents
  refill_frequency_days?: number; // Days between refills
  has_custom_address?: boolean;
  custom_address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } | null;
  patient: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    phone?: string;
    email?: string;
  };
  prescriber: {
    first_name: string;
    last_name: string;
    npi?: string;
    dea?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is a provider
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Check if provider is active before allowing prescription submission
    if (userRole === "provider") {
      const isActive = await checkProviderActive(user.id);
      if (!isActive) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your account is inactive. Please contact administrator to activate your account.",
          },
          { status: 403 },
        );
      }
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body: SubmitPrescriptionRequest = await request.json();

    // Validate required fields
    if (
      !body.prescriber_id ||
      !body.patient_id ||
      !body.medication ||
      !body.dosage
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if provider exists (optional - just for logging/tracking)
    const supabaseAdmin = createAdminClient();
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select(
        "id, is_active, payment_details, physical_address, billing_address, first_name, last_name, npi_number, dea_number, phone_number, signature_url",
      )
      .eq("user_id", body.prescriber_id)
      .single();

    // Log if provider not found but don't block prescription submission
    if (providerError || !provider) {
      // Provider profile not found - continuing anyway
    } else {
      // Check if profile is complete (just log warnings, don't block)
      const hasPaymentDetails =
        provider.payment_details &&
        typeof provider.payment_details === "object" &&
        Object.keys(provider.payment_details).length > 0;
      const hasPhysicalAddress =
        provider.physical_address &&
        typeof provider.physical_address === "object" &&
        Object.keys(provider.physical_address).length > 0;
      const hasBillingAddress =
        provider.billing_address &&
        typeof provider.billing_address === "object" &&
        Object.keys(provider.billing_address).length > 0;

      const profileComplete =
        hasPaymentDetails && hasPhysicalAddress && hasBillingAddress;

      // Check profile completeness but don't block submission
    }

    // Require pharmacy_id
    if (!body.pharmacy_id) {
      return NextResponse.json(
        { success: false, error: "pharmacy_id is required" },
        { status: 400 },
      );
    }

    // Get pharmacy backend credentials (supports DigitalRx and PioneerRx)
    const resolvedBackend = await resolvePharmacyBackendAny(supabaseAdmin, body.pharmacy_id);

    if (!resolvedBackend) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected pharmacy does not have a pharmacy backend configured.",
        },
        { status: 400 },
      );
    }

    let DIGITALRX_BASE_URL = resolvedBackend.baseUrl || DEFAULT_DIGITALRX_BASE_URL;

    if (DIGITALRX_BASE_URL) {
      DIGITALRX_BASE_URL = DIGITALRX_BASE_URL
        .replace(/^https?\/\/:/, "https://")
        .replace(/^https?:\/\/:/, "https://")
        .replace(/^https?\/\/\/+/, "https://");

      try {
        new URL(DIGITALRX_BASE_URL);
      } catch {
        console.error("Invalid pharmacy API URL:", DIGITALRX_BASE_URL);
        return NextResponse.json(
          {
            success: false,
            error: "Pharmacy API URL is invalid. Please contact administrator.",
          },
          { status: 500 },
        );
      }
    }

    const DIGITALRX_API_KEY = resolvedBackend.apiKey;
    const STORE_ID = resolvedBackend.storeId;
    const systemType = resolvedBackend.systemType;

    // Generate unique RxNumber for this prescription
    const rxNumber = `RX${Date.now()}`;
    const dateWritten = new Date().toISOString().split("T")[0];

    const { data: patientRecord } = await supabaseAdmin
      .from("patients")
      .select("data, phone, email, physical_address")
      .eq("id", body.patient_id)
      .single();

    const patientGender = patientRecord?.data?.gender?.toLowerCase();
    const patientSex = patientGender === "male" ? "M" : patientGender === "female" ? "F" : "U";

    const customAddr = body.custom_address as { street?: string; city?: string; state?: string; zipCode?: string; zip?: string } | null;
    const hasValidCustomAddress = body.has_custom_address
      && customAddr
      && customAddr.street
      && customAddr.city
      && customAddr.state
      && (customAddr.zipCode || customAddr.zip);
    const patientAddress = hasValidCustomAddress
      ? customAddr
      : patientRecord?.physical_address as { street?: string; city?: string; state?: string; zipCode?: string; zip?: string } | null;

    let pharmacyMedication: { ndc?: string; dosage_instructions?: string; notes?: string } | null = null;
    if (body.medication_id) {
      const { data: medData } = await supabaseAdmin
        .from("pharmacy_medications")
        .select("ndc, dosage_instructions, notes")
        .eq("id", body.medication_id)
        .single();
      pharmacyMedication = medData;
    }

    // Build DigitalRx payload matching their API spec — aligned with submit-to-pharmacy route
    const digitalRxPayload = {
      StoreID: STORE_ID,
      VendorName: VENDOR_NAME,
      Patient: {
        FirstName: body.patient.first_name,
        LastName: body.patient.last_name,
        DOB: body.patient.date_of_birth,
        Sex: patientSex,
        PatientStreet: patientAddress?.street,
        PatientCity: patientAddress?.city,
        PatientState: patientAddress?.state,
        PatientZip: patientAddress?.zipCode || patientAddress?.zip,
        PatientPhone: patientRecord?.phone || body.patient.phone,
        Email: patientRecord?.email || body.patient.email,
      },
      Doctor: {
        DoctorFirstName: provider?.first_name || body.prescriber.first_name,
        DoctorLastName: provider?.last_name || body.prescriber.last_name,
        DoctorNpi: provider?.npi_number || body.prescriber.npi,
        DoctorDea: provider?.dea_number || body.prescriber.dea,
        DoctorStreet: provider?.physical_address?.street,
        DoctorCity: provider?.physical_address?.city,
        DoctorState: provider?.physical_address?.state,
        DoctorZip: provider?.physical_address?.zipCode || provider?.physical_address?.zip,
        DoctorPhone: provider?.phone_number,
      },
      RxClaim: {
        RxNumber: rxNumber,
        DrugName: body.medication,
        DrugNDC: pharmacyMedication?.ndc,
        Qty: body.quantity.toString(),
        DateWritten: dateWritten,
        RequestedBy: (provider?.first_name || body.prescriber.first_name) + " " + (provider?.last_name || body.prescriber.last_name),
        Refills: body.refills.toString(),
        Instructions: body.sig || pharmacyMedication?.dosage_instructions,
        Notes: body.pharmacy_notes || pharmacyMedication?.notes,
        Daw: body.dispense_as_written ? "Y" : "N",
      },
      DocSignature: provider?.signature_url || null,
    };

    // Check if this is a direct payment (provider entered card) or payment link
    // If patient_price is provided but no immediate payment confirmation,
    // we should save as "pending_payment" and NOT submit to pharmacy yet
    const requiresPayment = true;

    let queueId = null;
    let digitalRxData = null;
    let prescriptionStatus = "pending_payment"; // Default status when payment is required

    // Only submit to DigitalRx if payment is NOT required or if already paid
    if (!requiresPayment) {
      // Submit to DigitalRx API
      let digitalRxResponse;
      try {
        digitalRxResponse = await fetch(`${DIGITALRX_BASE_URL}/RxWebRequest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: DIGITALRX_API_KEY,
          },
          body: JSON.stringify(digitalRxPayload),
        });
      } catch (fetchError) {
        console.error("❌ Failed to connect to pharmacy backend:", fetchError);
        console.error("❌ Backend URL was:", DIGITALRX_BASE_URL);
        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to connect to pharmacy backend. Please check pharmacy configuration.",
            details:
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError),
          },
          { status: 503 },
        );
      }

      if (!digitalRxResponse.ok) {
        const errorText = await digitalRxResponse
          .text()
          .catch(() => "Unknown error");
        console.error(
          "❌ DigitalRx API error:",
          digitalRxResponse.status,
          errorText,
        );
        return NextResponse.json(
          {
            success: false,
            error: `DigitalRx API error: ${digitalRxResponse.status} ${digitalRxResponse.statusText}`,
            details: errorText,
          },
          { status: digitalRxResponse.status },
        );
      }

      digitalRxData = await digitalRxResponse.json();

      // Check for error in response body (DigitalRx returns 200 OK with error in body)
      if (digitalRxData.Error) {
        // Check if it's just the invoice number validation warning (non-fatal)
        const isInvoiceWarning =
          typeof digitalRxData.Error === "string" &&
          digitalRxData.Error.includes("invoiceNumber") &&
          digitalRxData.Error.includes("MaxLength");

        // If it's not the invoice warning, or if there's no QueueID, treat as fatal error
        const hasQueueId =
          digitalRxData.QueueID || digitalRxData.queueId || digitalRxData.ID;

        if (!isInvoiceWarning && !hasQueueId) {
          console.error("❌ Fatal DigitalRx error:", digitalRxData.Error);
          return NextResponse.json(
            {
              success: false,
              error: `DigitalRx error: ${digitalRxData.Error}`,
              details: digitalRxData,
            },
            { status: 400 },
          );
        }

        // Silently ignore invoice warning if we have a QueueID - it's non-fatal
      }

      // Extract Queue ID from DigitalRx response
      queueId =
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
      prescriptionStatus = "submitted"; // Mark as submitted when sent to pharmacy
    }

    // Save prescription to Supabase with real Queue ID (supabaseAdmin already initialized above)

    // Convert patient_price from dollars to cents for total_paid_cents
    const medicationPriceCents = body.patient_price
      ? Math.round(parseFloat(body.patient_price) * 100)
      : 0;
    const totalPaidCents =
      medicationPriceCents + (body.profit_cents || 0) + (body.shipping_fee_cents || 0);

    const { data: prescription, error: prescriptionError } = await supabaseAdmin
      .from("prescriptions")
      .insert({
        prescriber_id: body.prescriber_id,
        patient_id: body.patient_id,
        encounter_id: body.encounter_id || null,
        appointment_id: body.appointment_id || null,
        medication: body.medication,
        dosage: body.dosage,
        dosage_amount: body.dosage_amount || null,
        dosage_unit: body.dosage_unit || null,
        vial_size: body.vial_size || null,
        form: body.form || null,
        quantity: body.quantity,
        refills: body.refills,
        sig: body.sig,
        dispense_as_written: body.dispense_as_written || false,
        pharmacy_notes: body.pharmacy_notes || null,
        patient_price: body.patient_price || null,
        pharmacy_id: body.pharmacy_id || null,
        medication_id: body.medication_id || null,
        profit_cents: body.profit_cents || 0, // Provider oversight/monitoring fees
        consultation_reason: body.consultation_reason || null, // Reason for the consultation fee
        shipping_fee_cents: body.shipping_fee_cents || 0, // Shipping fee
        total_paid_cents: totalPaidCents, // Medication price in cents
        refill_frequency_days: body.refill_frequency_days || null,
        next_refill_date: body.refill_frequency_days
          ? new Date(Date.now() + body.refill_frequency_days * 86400000).toISOString()
          : null,
        has_custom_address: body.has_custom_address || false,
        custom_address: body.custom_address || null,
        queue_id: queueId,
        status: prescriptionStatus, // "pending_payment" or "submitted"
        payment_status: requiresPayment ? "pending" : null, // Track payment status
      })
      .select()
      .single();

    if (prescriptionError) {
      console.error("❌ Error saving to database:", prescriptionError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Prescription submitted to DigitalRx but failed to save locally",
          error_details: prescriptionError,
          queue_id: queueId,
        },
        { status: 500 },
      );
    }

    // Log to system_logs
    await supabaseAdmin.from("system_logs").insert({
      user_id: body.prescriber_id,
      user_email: body.prescriber.first_name + "@example.com",
      user_name: `Dr. ${body.prescriber.first_name} ${body.prescriber.last_name}`,
      action: "PRESCRIPTION_SUBMITTED",
      details: `${systemType}: ${body.medication} ${body.dosage} for ${body.patient.first_name} ${body.patient.last_name}`,
      queue_id: queueId,
      status: "success",
    });

    if (requiresPayment) {
      return NextResponse.json(
        {
          success: true,
          message: "Prescription created - awaiting payment",
          prescription_id: prescription.id,
          requires_payment: true,
          status: "pending_payment",
        },
        { status: 201 },
      );
    } else {
      return NextResponse.json(
        {
          success: true,
          message: "Prescription submitted to DigitalRx successfully",
          queue_id: queueId,
          prescription_id: prescription.id,
          digitalrx_response: digitalRxData,
          status: "submitted",
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("❌ API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error details:", errorMessage);

    // Return detailed error for debugging (only in development)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          error_details: error instanceof Error ? error.stack : String(error),
        }),
      },
      { status: 500 },
    );
  }
}
