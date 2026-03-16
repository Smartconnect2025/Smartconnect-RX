import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@core/database/client";
import { patientAuthService } from "@features/basic-emr/services/patientAuthService";
import { envConfig } from "@core/config";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

export interface CreatePatientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  physicalAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  preferredLanguage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // For API routes, we don't need to set cookies back
            // The session is read-only in this context
          },
        },
      },
    );

    // Get the current user from the request
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const patientData: CreatePatientData = await request.json();

    // Get provider ID from the current user
    const { data: providerData, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (providerError || !providerData) {
      console.error("Provider lookup error:", providerError);
      console.error("User ID:", user.id);
      return NextResponse.json(
        {
          error: "Only providers can create patients",
          details: providerError?.message,
          userId: user.id,
        },
        { status: 403 },
      );
    }

    // Create admin client for operations that need to bypass RLS
    const adminClient = createAdminClient();

    // Check if a patient with this email already exists (use adminClient to bypass RLS)
    const { data: existingPatient } = await adminClient
      .from("patients")
      .select("id, first_name, last_name")
      .eq("email", patientData.email)
      .single();

    if (existingPatient) {
      return NextResponse.json(
        {
          error: `A patient with email ${patientData.email} already exists`,
          details: `Patient: ${existingPatient.first_name} ${existingPatient.last_name}`,
        },
        { status: 409 },
      );
    }

    // Check if auth user already exists
    const {
      data: { users: existingAuthUsers },
    } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.find(
      (u) => u.email === patientData.email,
    );

    let authUserId: string;

    if (existingAuthUser) {
      // User exists in auth but not in patients table - reuse the auth user
      authUserId = existingAuthUser.id;
    } else {
      // Generate a temporary password (patient will need to reset it)
      const tempPassword = `Temp${Math.random().toString(36).substring(2, 15)}!`;

      const { data: authUser, error: authUserError } =
        await adminClient.auth.admin.createUser({
          email: patientData.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            role: "patient",
          },
        });

      if (authUserError || !authUser.user) {
        return NextResponse.json(
          {
            error: `Failed to create patient auth account: ${authUserError?.message}`,
          },
          { status: 400 },
        );
      }

      authUserId = authUser.user.id;
    }

    // Create patient record
    // Use provider record ID (required by foreign key constraint)
    const dbPatient = {
      user_id: authUserId,
      first_name: patientData.firstName,
      last_name: patientData.lastName,
      email: patientData.email,
      phone: patientData.phone,
      date_of_birth: patientData.dateOfBirth,
      provider_id: providerData.id, // Provider record ID (FK to providers.id)
      // Use address field as physical_address (unified storage)
      physical_address:
        patientData?.address || patientData?.physicalAddress || null,
      billing_address: patientData?.billingAddress || null,
      data: {
        gender: patientData?.gender,
        // address is now stored in physical_address column, not in data
        emergencyContact: patientData?.emergencyContact,
        insurance: patientData?.insurance,
        preferredLanguage: patientData?.preferredLanguage,
      },
    };

    // Use adminClient to bypass RLS since provider is creating a patient for another user
    const { data: patient, error: patientError } = await adminClient
      .from("patients")
      .insert([dbPatient])
      .select()
      .single();

    if (patientError) {
      console.error("Patient creation RLS error:", patientError);
      console.error("Provider ID used:", providerData.id);
      // If patient creation fails, clean up the auth user (only if we just created it)
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(authUserId);
      }
      return NextResponse.json(
        {
          error: `Failed to create patient record: ${patientError.message}`,
          details: patientError,
          providerId: providerData.id,
        },
        { status: 400 },
      );
    }

    // Create provider-patient mapping
    const { error: mappingError } = await supabase
      .from("provider_patient_mappings")
      .insert({
        provider_id: providerData.id,
        patient_id: patient.id,
      });

    if (mappingError) {
      // If mapping fails, clean up both patient and auth user
      await supabase.from("patients").delete().eq("id", patient.id);
      await adminClient.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        {
          error: `Failed to create provider-patient mapping: ${mappingError.message}`,
        },
        { status: 400 },
      );
    }

    // Send welcome email to patient (optional - don't fail if this doesn't work)
    try {
      await patientAuthService.sendWelcomeEmail(
        patientData.email,
        `${patientData.firstName} ${patientData.lastName}`,
      );
    } catch {
      // Log the error but don't fail the patient creation
    }

    // Map the database patient to the expected format
    const mappedPatient = {
      id: patient.id,
      firstName: patient.first_name,
      lastName: patient.last_name,
      email: patient.email || "",
      phone: patient.phone || "",
      dateOfBirth: patient.date_of_birth,
      gender: patient.data?.gender,
      // Read from physical_address column, fallback to data.address for legacy records
      address: patient.physical_address || patient.data?.address,
      physical_address: patient.physical_address,
      billing_address: patient.billing_address,
      emergencyContact: patient.data?.emergencyContact,
      insurance: patient.data?.insurance,
      preferredLanguage: patient.data?.preferredLanguage,
      is_active: patient.is_active,
    };

    return NextResponse.json({
      success: true,
      data: mappedPatient,
    });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
