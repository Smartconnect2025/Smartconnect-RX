/**
 * Pharmacy Order Reports API
 *
 * Provides order statistics grouped by pharmacy and provider
 * with filtering by date range
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function GET(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const scope = await getPharmacyAdminScope(user.id);

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const pharmacyId = scope.isPharmacyAdmin ? scope.pharmacyId : searchParams.get("pharmacyId");

    const supabase = await createServerClient();


    // Build query for prescriptions with provider and patient info
    // This fetches from the incoming prescriptions queue
    // Only include prescriptions with valid status (submitted, billing, approved, packed, shipped, delivered)
    let query = supabase
      .from("prescriptions")
      .select("*")
      .in("status", ["submitted", "billing", "approved", "packed", "shipped", "delivered"]);

    // Apply filters
    if (startDate) {
      query = query.gte("submitted_at", startDate);
    }
    if (endDate) {
      query = query.lte("submitted_at", endDate);
    }
    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    query = query.order("submitted_at", { ascending: false });

    const { data: prescriptions, error } = await query;

    if (error) {
      console.error("Error fetching prescriptions:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: "Failed to fetch prescriptions", details: error.message },
        { status: 500 },
      );
    }

    // Return empty report if no prescriptions found
    if (!prescriptions || prescriptions.length === 0) {
      return NextResponse.json({
        success: true,
        report: [],
        totalPrescriptions: 0,
      });
    }

    // Fetch related data separately to avoid complex join issues
    const prescriberIds = [...new Set(prescriptions.map(p => p.prescriber_id).filter(Boolean))];
    const patientIds = [...new Set(prescriptions.map(p => p.patient_id).filter(Boolean))];
    const pharmacyIds = [...new Set(prescriptions.map(p => p.pharmacy_id).filter(Boolean))];
    const medicationIds = [...new Set(prescriptions.map(p => p.medication_id).filter(Boolean))];

    // Fetch providers (using user_id to match prescriber_id)
    const { data: providers } = await supabase
      .from("providers")
      .select("id, user_id, first_name, last_name, email, group_id")
      .in("user_id", prescriberIds);

    // Fetch patients
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email")
      .in("id", patientIds);

    // Fetch pharmacies
    const { data: pharmacies } = await supabase
      .from("pharmacies")
      .select("id, name")
      .in("id", pharmacyIds);

    // Fetch medications
    const { data: medications } = await supabase
      .from("pharmacy_medications")
      .select("id, name, strength, dosage_form, price_cents")
      .in("id", medicationIds);

    // Create lookup maps for quick access
    // Note: Map providers by user_id since prescriber_id is a user_id
    const providerMap = new Map(providers?.map(p => [p.user_id, p]) || []);
    const patientMap = new Map(patients?.map(p => [p.id, p]) || []);
    const pharmacyMap = new Map(pharmacies?.map(p => [p.id, p]) || []);
    const medicationMap = new Map(medications?.map(m => [m.id, m]) || []);

    // Group prescriptions by pharmacy and provider
    const reportData: Record<string, {
      pharmacy: { id: string; name: string };
      providers: Record<string, {
        provider: { id: string; name: string; email: string; group_id: string | null };
        orders: Array<{
          id: string;
          queue_id: string;
          date: string;
          patient: string;
          medication: string;
          quantity: number;
          refills: number;
          sig: string;
          price: number;
          medicationPrice: number;
          providerFees: number;
          status: string;
        }>;
        totalOrders: number;
        totalAmount: number;
        totalMedicationAmount: number;
        totalProviderFees: number;
      }>;
      totalOrders: number;
      totalAmount: number;
    }> = {};

    prescriptions?.forEach((prescription) => {
      try {
        const pharmacyId = prescription.pharmacy_id || "unspecified";
        const pharmacy = pharmacyMap.get(pharmacyId);
        const pharmacyName = pharmacy?.name || "Not specified";

        // prescriber_id is a user_id, so look up provider by user_id
        const prescriberId = prescription.prescriber_id || "unspecified";
        const provider = providerMap.get(prescriberId);
        const providerId = provider?.id || "unspecified"; // Get actual provider.id for grouping
        const providerName = provider
          ? `${provider.first_name || ""} ${provider.last_name || ""}`.trim() || "Unknown Provider"
          : "Unknown Provider";
        const providerEmail = provider?.email || "";

        // Initialize pharmacy if not exists
        if (!reportData[pharmacyId]) {
          reportData[pharmacyId] = {
            pharmacy: { id: pharmacyId, name: pharmacyName },
            providers: {},
            totalOrders: 0,
            totalAmount: 0,
          };
        }

        // Initialize provider if not exists (group by provider.id)
        if (!reportData[pharmacyId].providers[providerId]) {
          reportData[pharmacyId].providers[providerId] = {
            provider: { id: providerId, name: providerName, email: providerEmail, group_id: provider?.group_id || null },
            orders: [],
            totalOrders: 0,
            totalAmount: 0,
            totalMedicationAmount: 0,
            totalProviderFees: 0,
          };
        }

        // Calculate medication price and provider fees separately
        const medicationPriceCents = prescription.total_paid_cents || 0;
        const providerFeeCents = prescription.profit_cents || 0;
        const medicationPriceInDollars = medicationPriceCents / 100;
        const providerFeesInDollars = providerFeeCents / 100;

        // If no total_paid_cents, fall back to patient_price (legacy)
        const finalMedicationPrice = prescription.total_paid_cents
          ? medicationPriceInDollars
          : (prescription.patient_price ? parseFloat(prescription.patient_price) : 0);

        const finalProviderFees = providerFeesInDollars;
        const finalTotalPrice = finalMedicationPrice + finalProviderFees;

        const patient = patientMap.get(prescription.patient_id);
        const medication = medicationMap.get(prescription.medication_id);

        // Build medication display name with strength and form
        let medicationDisplay = "Unknown Medication";
        if (medication) {
          medicationDisplay = medication.name;
          if (medication.strength) {
            medicationDisplay += ` ${medication.strength}`;
          }
          if (medication.dosage_form) {
            medicationDisplay += ` ${medication.dosage_form}`;
          }
        } else if (prescription.medication) {
          // Fall back to legacy medication field if medication_id lookup fails
          medicationDisplay = prescription.medication;
        }

        // Add order to provider
        reportData[pharmacyId].providers[providerId].orders.push({
          id: prescription.id,
          queue_id: prescription.queue_id || "",
          date: prescription.submitted_at,
          patient: patient
            ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown Patient"
            : "Unknown Patient",
          medication: medicationDisplay,
          quantity: prescription.quantity || 0,
          refills: prescription.refills || 0,
          sig: prescription.sig || "",
          price: finalTotalPrice,
          medicationPrice: finalMedicationPrice,
          providerFees: finalProviderFees,
          status: prescription.status,
        });

        // Update totals
        reportData[pharmacyId].providers[providerId].totalOrders++;
        reportData[pharmacyId].providers[providerId].totalAmount += finalTotalPrice;
        reportData[pharmacyId].providers[providerId].totalMedicationAmount += finalMedicationPrice;
        reportData[pharmacyId].providers[providerId].totalProviderFees += finalProviderFees;
        reportData[pharmacyId].totalOrders++;
        reportData[pharmacyId].totalAmount += finalTotalPrice;
      } catch (prescriptionError) {
        console.error("Error processing prescription:", prescription.id, prescriptionError);
        // Continue with next prescription
      }
    });

    // Convert to array format
    const report = Object.values(reportData).map((pharmacy) => ({
      ...pharmacy,
      providers: Object.values(pharmacy.providers),
    }));

    return NextResponse.json({
      success: true,
      report,
      totalPrescriptions: prescriptions?.length || 0,
    });
  } catch (error) {
    console.error("Error generating pharmacy reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
