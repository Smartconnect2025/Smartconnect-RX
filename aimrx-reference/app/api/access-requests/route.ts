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
        <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 80px; margin-bottom: 15px;" />
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
      email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 80px; margin-bottom: 15px;" />
            <h1 style="color: white; margin: 0; font-size: 24px;">New Provider Access Request</h1>
          </div>

          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Personal Information</h2>
              <p style="margin: 8px 0;"><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</p>
              <p style="margin: 8px 0;"><strong>Email:</strong> ${formData.email}</p>
              <p style="margin: 8px 0;"><strong>Phone:</strong> ${formData.phone}</p>
              ${formData.companyName ? `<p style="margin: 8px 0;"><strong>Company Name:</strong> ${formData.companyName}</p>` : ""}
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Medical Credentials</h2>
              <p style="margin: 8px 0;"><strong>NPI Number:</strong> ${formData.npiNumber}</p>
              <p style="margin: 8px 0;"><strong>Medical License:</strong> ${formData.medicalLicense}</p>
              <p style="margin: 8px 0;"><strong>License State:</strong> ${formData.licenseState}</p>
              <p style="margin: 8px 0;"><strong>Specialty:</strong> ${formData.specialty}</p>
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Practice Information</h2>
              <p style="margin: 8px 0;"><strong>Address:</strong> ${formData.practiceAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}</p>
              <p style="margin: 8px 0;"><strong>Years in Practice:</strong> ${formData.yearsInPractice}</p>
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Additional Information</h2>
              ${formData.patientsPerMonth ? `<p style="margin: 8px 0;"><strong>Patients Per Month:</strong> ${formData.patientsPerMonth}</p>` : ""}
              ${formData.interestedIn ? `<p style="margin: 8px 0;"><strong>Interested In:</strong> ${formData.interestedIn}</p>` : ""}
              ${formData.hearAboutUs ? `<p style="margin: 8px 0;"><strong>How They Heard About Us:</strong> ${formData.hearAboutUs}</p>` : ""}
              ${formData.additionalInfo ? `<p style="margin: 8px 0;"><strong>Additional Info:</strong> ${formData.additionalInfo}</p>` : ""}
            </div>

            <div style="background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
                <strong>Action Required:</strong> Please review this application and set up the provider account if approved.
              </p>
            </div>
          </div>

          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.</p>
          </div>
        </div>
      `;
    } else if (type === "pharmacy") {
      emailSubject = `New Pharmacy Network Application - ${formData.pharmacyName}`;
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 80px; margin-bottom: 15px;" />
            <h1 style="color: white; margin: 0; font-size: 24px;">New Pharmacy Network Application</h1>
          </div>

          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Pharmacy Information</h2>
              <p style="margin: 8px 0;"><strong>Pharmacy Name:</strong> ${formData.pharmacyName}</p>
              <p style="margin: 8px 0;"><strong>Owner/Director:</strong> ${formData.ownerName}</p>
              <p style="margin: 8px 0;"><strong>Email:</strong> ${formData.email}</p>
              <p style="margin: 8px 0;"><strong>Phone:</strong> ${formData.phone}</p>
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Licensing & Credentials</h2>
              <p style="margin: 8px 0;"><strong>License Number:</strong> ${formData.licenseNumber}</p>
              <p style="margin: 8px 0;"><strong>License State:</strong> ${formData.licenseState}</p>
              <p style="margin: 8px 0;"><strong>DEA Number:</strong> ${formData.deaNumber}</p>
              ${formData.ncpdpNumber ? `<p style="margin: 8px 0;"><strong>NCPDP Number:</strong> ${formData.ncpdpNumber}</p>` : ""}
              ${formData.accreditations ? `<p style="margin: 8px 0;"><strong>Accreditations:</strong> ${formData.accreditations}</p>` : ""}
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Location Information</h2>
              <p style="margin: 8px 0;"><strong>Address:</strong> ${formData.pharmacyAddress}, ${formData.city}, ${formData.state} ${formData.zipCode}</p>
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Compounding Capabilities</h2>
              <p style="margin: 8px 0;"><strong>Years in Business:</strong> ${formData.yearsInBusiness}</p>
              <p style="margin: 8px 0;"><strong>Compounding Experience:</strong> ${formData.compoundingExperience} years</p>
              ${formData.monthlyCapacity ? `<p style="margin: 8px 0;"><strong>Monthly Capacity:</strong> ${formData.monthlyCapacity}</p>` : ""}
              <p style="margin: 8px 0;"><strong>Specializations:</strong> ${formData.specializations}</p>
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">System & Integration</h2>
              <p style="margin: 8px 0;"><strong>Current System:</strong> ${formData.currentSystem}</p>
              ${formData.systemVersion ? `<p style="margin: 8px 0;"><strong>System Version:</strong> ${formData.systemVersion}</p>` : ""}
              ${formData.integrationType ? `<p style="margin: 8px 0;"><strong>Preferred Integration:</strong> ${formData.integrationType}</p>` : ""}
            </div>

            <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
              <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Additional Information</h2>
              ${formData.hearAboutUs ? `<p style="margin: 8px 0;"><strong>How They Heard About Us:</strong> ${formData.hearAboutUs}</p>` : ""}
              ${formData.additionalInfo ? `<p style="margin: 8px 0;"><strong>Additional Info:</strong> ${formData.additionalInfo}</p>` : ""}
            </div>

            <div style="background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
                <strong>Action Required:</strong> Please review this pharmacy application and set up the account if approved.
              </p>
            </div>
          </div>

          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.</p>
          </div>
        </div>
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
          email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
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
