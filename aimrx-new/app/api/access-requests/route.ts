import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { createAdminClient } from "@core/database/client";
import { createServerClient } from "@core/supabase/server";
import { accessRequestConfirmationHtml, adminAccessRequestHtml, adminDetailCard } from "@core/services/email/emailTemplates";

async function sendConfirmationEmailToApplicant(
  email: string,
  firstName: string
) {
  const confirmationSubject =
    "Thank you for your interest in SmartConnect RX Marketplace";
  const confirmationHtml = accessRequestConfirmationHtml(firstName);

  const msg = {
    to: email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
      name: process.env.SENDGRID_FROM_NAME || "SmartConnect RX",
    },
    subject: confirmationSubject,
    html: confirmationHtml,
  };

  await sgMail.send(msg);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, formData } = body;

    if (!type || !formData) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Store the request in the database
    const supabaseAdmin = createAdminClient();

    const { error: dbError } = await supabaseAdmin
      .from("access_requests")
      .insert({
        type,
        status: "pending",
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        email: formData.email,
        phone: formData.phone || null,
        form_data: formData,
      });

    if (dbError) {
      console.error("Error saving access request to database:", dbError);
      // Continue to send email even if database save fails
    } else {
    }

    // Check if SendGrid is configured
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {


      return NextResponse.json(
        {
          success: true,
          message: "Request received successfully",
          note: "Email notifications are currently disabled"
        },
        { status: 200 }
      );
    }

    // Initialize SendGrid
    sgMail.setApiKey(sendGridApiKey);

    // Format email content based on request type
    let emailSubject = "";
    let emailContent = "";

    if (type === "doctor") {
      const pharmacyRef = formData.referringPharmacyName
        ? ` (via ${formData.referringPharmacyName})`
        : "";
      emailSubject = `New Provider Access Request - ${formData.firstName} ${formData.lastName}${pharmacyRef}`;

      const personalFields = [
        { label: "Name", value: `${formData.firstName} ${formData.lastName}` },
        { label: "Email", value: formData.email },
        { label: "Phone", value: formData.phone },
      ];
      if (formData.companyName) personalFields.push({ label: "Company Name", value: formData.companyName });
      if (formData.referringPharmacyName) personalFields.push({ label: "Referred by Pharmacy", value: formData.referringPharmacyName });

      const credFields = [
        { label: "NPI Number", value: formData.npiNumber },
        { label: "Medical License", value: formData.medicalLicense },
        { label: "License State", value: formData.licenseState },
        { label: "Specialty", value: formData.specialty },
      ];

      const practiceFields = [
        { label: "Address", value: `${formData.practiceAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}` },
        { label: "Years in Practice", value: formData.yearsInPractice },
      ];

      const additionalFields: { label: string; value: string }[] = [];
      if (formData.patientsPerMonth) additionalFields.push({ label: "Patients Per Month", value: formData.patientsPerMonth });
      if (formData.interestedIn) additionalFields.push({ label: "Interested In", value: formData.interestedIn });
      if (formData.hearAboutUs) additionalFields.push({ label: "How They Heard About Us", value: formData.hearAboutUs });
      if (formData.additionalInfo) additionalFields.push({ label: "Additional Info", value: formData.additionalInfo });

      emailContent = adminAccessRequestHtml({
        heading: "New Provider Access Request",
        detailCards:
          adminDetailCard("Personal Information", personalFields) +
          adminDetailCard("Medical Credentials", credFields) +
          adminDetailCard("Practice Information", practiceFields) +
          (additionalFields.length > 0 ? adminDetailCard("Additional Information", additionalFields) : ""),
      });
    } else if (type === "pharmacy") {
      emailSubject = `New Pharmacy Network Application - ${formData.pharmacyName}`;

      const pharmacyFields = [
        { label: "Pharmacy Name", value: formData.pharmacyName },
        { label: "Owner/Director", value: formData.ownerName },
        { label: "Email", value: formData.email },
        { label: "Phone", value: formData.phone },
      ];

      const licenseFields = [
        { label: "License Number", value: formData.licenseNumber },
        { label: "License State", value: formData.licenseState },
        { label: "DEA Number", value: formData.deaNumber },
      ];
      if (formData.ncpdpNumber) licenseFields.push({ label: "NCPDP Number", value: formData.ncpdpNumber });
      if (formData.accreditations) licenseFields.push({ label: "Accreditations", value: formData.accreditations });

      const compoundingFields = [
        { label: "Years in Business", value: formData.yearsInBusiness },
        { label: "Compounding Experience", value: `${formData.compoundingExperience} years` },
        { label: "Specializations", value: formData.specializations },
      ];
      if (formData.monthlyCapacity) compoundingFields.push({ label: "Monthly Capacity", value: formData.monthlyCapacity });

      const systemFields = [
        { label: "Current System", value: formData.currentSystem },
      ];
      if (formData.systemVersion) systemFields.push({ label: "System Version", value: formData.systemVersion });
      if (formData.integrationType) systemFields.push({ label: "Preferred Integration", value: formData.integrationType });

      const additionalFields: { label: string; value: string }[] = [];
      if (formData.hearAboutUs) additionalFields.push({ label: "How They Heard About Us", value: formData.hearAboutUs });
      if (formData.additionalInfo) additionalFields.push({ label: "Additional Info", value: formData.additionalInfo });

      emailContent = adminAccessRequestHtml({
        heading: "New Pharmacy Network Application",
        detailCards:
          adminDetailCard("Pharmacy Information", pharmacyFields) +
          adminDetailCard("Licensing & Credentials", licenseFields) +
          adminDetailCard("Location", [{ label: "Address", value: `${formData.pharmacyAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}` }]) +
          adminDetailCard("Compounding Capabilities", compoundingFields) +
          adminDetailCard("System & Integration", systemFields) +
          (additionalFields.length > 0 ? adminDetailCard("Additional Information", additionalFields) : ""),
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Send notification email to admin
    try {
      const adminMsg = {
        to: "support@smartconnectrx.com",
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
          name: process.env.SENDGRID_FROM_NAME || "SmartConnect RX"
        },
        subject: emailSubject,
        html: emailContent,
      };

      await sgMail.send(adminMsg);

      // Send confirmation email to the applicant
      try {
        await sendConfirmationEmailToApplicant(
          formData.email,
          formData.firstName || "there"
        );
      } catch (confirmationError) {
        console.error("Error sending confirmation email to applicant:", confirmationError);
        // Don't fail the request if confirmation email fails
      }

      return NextResponse.json(
        { success: true, message: "Request submitted successfully" },
        { status: 200 }
      );
    } catch (emailError) {
      console.error("Error with email service:", emailError);
      return NextResponse.json(
        { success: false, error: "Email service error" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing access request:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get access requests (admin only)
 * GET /api/access-requests?type=doctor&status=pending
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    // Check authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'doctor' or 'pharmacy'
    const status = searchParams.get("status") || "pending"; // 'pending', 'approved', 'rejected'

    // Build query
    let query = supabaseAdmin.from("access_requests").select("*");

    if (type) {
      query = query.eq("type", type);
    }

    if (status) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error("Error fetching access requests:", requestsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch access requests" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requests: requests || [],
    });
  } catch (error) {
    console.error("Error in GET access requests:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch access requests",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
