import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { createAdminClient } from "@core/database/client";
import { createServerClient } from "@core/supabase/server";

async function sendConfirmationEmailToApplicant(
  email: string,
  firstName: string
) {
  const confirmationSubject =
    "Thank you for your interest in AIM Medical Marketplace";
  const confirmationHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <img src="https://i.imgur.com/r65O4DB.png" alt="AIM Medical Technologies" style="height: 80px; margin-bottom: 15px;" />
        <h1 style="color: white; margin: 0; font-size: 24px;">Request Received</h1>
      </div>

      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Hello ${firstName},
        </p>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Thank you for reaching out to join the AIM Medical Marketplace. We've received your request for access and are excited to have you join our network of providers.
        </p>

        <div style="background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #1E3A8A;">
            <strong>What's next?</strong>
          </p>
          <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
            Our team is currently reviewing your application and finalizing your account setup. We want to ensure you have a smooth experience from the moment you first log in.
          </p>
        </div>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          You can expect to receive an update from us within <strong>24 to 48 hours</strong>. Once your account is ready, we will send you a follow-up email with your login credentials and a quick guide to help you get started.
        </p>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          We look forward to working with you and supporting your practice.
        </p>

        <p style="font-size: 16px; line-height: 1.6; margin-top: 30px;">
          Best regards,<br>
          <strong>AIM RX Portal Team</strong>
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p style="margin: 5px 0;">© ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.</p>
      </div>
    </div>
  `;

  const msg = {
    to: email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com",
      name: process.env.SENDGRID_FROM_NAME || "AIM RX Portal",
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
      emailSubject = `New Provider Access Request - ${formData.firstName} ${formData.lastName}`;
      emailContent = `
        <h2>New Provider Access Request</h2>

        <h3>Personal Information</h3>
        <ul>
          <li><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</li>
          <li><strong>Email:</strong> ${formData.email}</li>
          <li><strong>Phone:</strong> ${formData.phone}</li>
          ${formData.companyName ? `<li><strong>Company Name:</strong> ${formData.companyName}</li>` : ""}
        </ul>

        <h3>Medical Credentials</h3>
        <ul>
          <li><strong>NPI Number:</strong> ${formData.npiNumber}</li>
          <li><strong>Medical License:</strong> ${formData.medicalLicense}</li>
          <li><strong>License State:</strong> ${formData.licenseState}</li>
          <li><strong>Specialty:</strong> ${formData.specialty}</li>
        </ul>

        <h3>Practice Information</h3>
        <ul>
          <li><strong>Address:</strong> ${formData.practiceAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}</li>
          <li><strong>Years in Practice:</strong> ${formData.yearsInPractice}</li>
        </ul>

        <h3>Additional Information</h3>
        <ul>
          ${formData.patientsPerMonth ? `<li><strong>Patients Per Month:</strong> ${formData.patientsPerMonth}</li>` : ""}
          ${formData.interestedIn ? `<li><strong>Interested In:</strong> ${formData.interestedIn}</li>` : ""}
          ${formData.hearAboutUs ? `<li><strong>How They Heard About Us:</strong> ${formData.hearAboutUs}</li>` : ""}
          ${formData.additionalInfo ? `<li><strong>Additional Info:</strong> ${formData.additionalInfo}</li>` : ""}
        </ul>
      `;
    } else if (type === "pharmacy") {
      emailSubject = `New Pharmacy Network Application - ${formData.pharmacyName}`;
      emailContent = `
        <h2>New Pharmacy Network Application</h2>

        <h3>Pharmacy Information</h3>
        <ul>
          <li><strong>Pharmacy Name:</strong> ${formData.pharmacyName}</li>
          <li><strong>Owner/Director:</strong> ${formData.ownerName}</li>
          <li><strong>Email:</strong> ${formData.email}</li>
          <li><strong>Phone:</strong> ${formData.phone}</li>
        </ul>

        <h3>Licensing & Credentials</h3>
        <ul>
          <li><strong>License Number:</strong> ${formData.licenseNumber}</li>
          <li><strong>License State:</strong> ${formData.licenseState}</li>
          <li><strong>DEA Number:</strong> ${formData.deaNumber}</li>
          ${formData.ncpdpNumber ? `<li><strong>NCPDP Number:</strong> ${formData.ncpdpNumber}</li>` : ""}
          ${formData.accreditations ? `<li><strong>Accreditations:</strong> ${formData.accreditations}</li>` : ""}
        </ul>

        <h3>Location Information</h3>
        <ul>
          <li><strong>Address:</strong> ${formData.pharmacyAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}</li>
        </ul>

        <h3>Compounding Capabilities</h3>
        <ul>
          <li><strong>Years in Business:</strong> ${formData.yearsInBusiness}</li>
          <li><strong>Compounding Experience:</strong> ${formData.compoundingExperience} years</li>
          ${formData.monthlyCapacity ? `<li><strong>Monthly Capacity:</strong> ${formData.monthlyCapacity}</li>` : ""}
          <li><strong>Specializations:</strong> ${formData.specializations}</li>
        </ul>

        <h3>System & Integration</h3>
        <ul>
          <li><strong>Current System:</strong> ${formData.currentSystem}</li>
          ${formData.systemVersion ? `<li><strong>System Version:</strong> ${formData.systemVersion}</li>` : ""}
          ${formData.integrationType ? `<li><strong>Preferred Integration:</strong> ${formData.integrationType}</li>` : ""}
        </ul>

        <h3>Additional Information</h3>
        <ul>
          ${formData.hearAboutUs ? `<li><strong>How They Heard About Us:</strong> ${formData.hearAboutUs}</li>` : ""}
          ${formData.additionalInfo ? `<li><strong>Additional Info:</strong> ${formData.additionalInfo}</li>` : ""}
        </ul>
      `;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Send notification email to admin
    try {
      const adminMsg = {
        to: "support@aimrx.com",
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com",
          name: process.env.SENDGRID_FROM_NAME || "AIM RX Portal"
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
