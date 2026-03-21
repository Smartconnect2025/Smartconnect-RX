import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import sgMail from "@sendgrid/mail";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function POST(request: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, password, tierLevel, groupId, npiNumber, medicalLicense, licenseState, companyName, physicalAddress, billingAddress, referringPharmacyId } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createAdminClient();

    // Create auth user with email already confirmed
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role: "provider",
        },
      });

    if (authError || !authUser.user) {
      console.error("Error creating auth user:", authError);

      // Detect duplicate user error from Supabase
      const isDuplicate =
        // Check specific error codes (most reliable)
        authError?.code === "user_already_exists" ||
        authError?.code === "email_exists" ||
        // Fallback to HTTP status
        (authError as { status?: number })?.status === 422 ||
        // Fallback to message check (least reliable)
        authError?.message?.toLowerCase().includes("already") ||
        authError?.message?.toLowerCase().includes("exists");

      return NextResponse.json(
        {
          error: isDuplicate
            ? "A user with this email already exists"
            : authError?.message || "Failed to create user account",
        },
        { status: isDuplicate ? 400 : 500 }
      );
    }

    // Create user_roles record (REQUIRED for login to work)
    // user_roles.id is bigint without auto-increment — must set explicitly
    // Retry loop handles race conditions when concurrent inserts pick the same ID
    let roleError: { message: string; toString: () => string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: maxIdRow } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      const rawId = maxIdRow?.id ?? 0;
      const nextId = Number(rawId) + 1;

      const { error } = await supabaseAdmin.from("user_roles").insert({
        id: nextId,
        user_id: authUser.user.id,
        role: "provider",
      });

      if (!error) {
        roleError = null;
        break;
      }

      if (error.message?.includes("duplicate") || error.code === "23505") {
        roleError = error;
        continue;
      }

      roleError = error;
      break;
    }

    if (roleError) {
      console.error("Error creating user role:", roleError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        {
          error: "Failed to create user role",
          details: roleError.message || roleError.toString()
        },
        { status: 500 }
      );
    }

    // Create provider record using admin client (has proper permissions)
    // Set is_active to false initially - provider must complete profile before becoming active
    // Build medical_licenses array if license data provided
    const medicalLicenses = medicalLicense && licenseState
      ? [{ licenseNumber: medicalLicense, state: licenseState }]
      : null;

    const { error: providerError, data: providerData } = await supabaseAdmin
      .from("providers")
      .insert({
        user_id: authUser.user.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phone || null,
        npi_number: npiNumber || null,
        medical_licenses: medicalLicenses,
        licensed_states: licenseState ? [licenseState] : null,
        company_name: companyName || null,
        group_id: groupId || null,
        physical_address: physicalAddress || null,
        billing_address: billingAddress || null,
        is_active: false, // Pending until profile is completed
      })
      .select()
      .single();

    if (providerError) {
      console.error("Error creating provider record:", providerError);
      // Clean up auth user and role if provider creation fails
      await supabaseAdmin.from("user_roles").delete().eq("user_id", authUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        {
          error: "Failed to create provider record",
          details: providerError?.message || providerError?.toString()
        },
        { status: 500 }
      );
    }

    if (providerData) {
      let pharmacyIdToLink: string | null = null;

      const inviterScope = await getPharmacyAdminScope(user.id);

      if (inviterScope.isPharmacyAdmin && inviterScope.pharmacyId) {
        pharmacyIdToLink = inviterScope.pharmacyId;
      } else if (referringPharmacyId) {
        const { data: refPharmacy } = await supabaseAdmin
          .from("pharmacies")
          .select("id")
          .eq("id", referringPharmacyId)
          .eq("is_active", true)
          .single();
        if (refPharmacy) {
          pharmacyIdToLink = refPharmacy.id;
        }
      }

      if (pharmacyIdToLink) {
        const { error: linkError } = await supabaseAdmin
          .from("provider_pharmacy_links")
          .upsert({
            provider_id: authUser.user.id,
            pharmacy_id: pharmacyIdToLink,
          }, { onConflict: "provider_id,pharmacy_id" });

        if (linkError) {
          console.error("Failed to link provider to pharmacy:", linkError);
          await supabaseAdmin.from("providers").delete().eq("id", providerData.id);
          await supabaseAdmin.from("user_roles").delete().eq("user_id", authUser.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json(
            { error: "Failed to link provider to pharmacy. Provider was not created." },
            { status: 500 }
          );
        }
      }
    }

    if (tierLevel && providerData) {
      const { error: tierError } = await supabaseAdmin
        .from("providers")
        .update({ tier_level: tierLevel })
        .eq("id", providerData.id);

      if (tierError) {
        console.error("Error setting tier level:", tierError);
        // Don't fail the entire request if tier assignment fails
      }
    }

    // Send welcome email with credentials
    try {
      const sendGridApiKey = process.env.SENDGRID_API_KEY;

      if (sendGridApiKey) {
        sgMail.setApiKey(sendGridApiKey);

        const appUrl = "https://app.smartconnectrx.com/auth/login";

        const emailSubject = "Welcome to SmartConnect RX - Your Provider Account";
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <img src="https://smartconnectrx.com/logo-header.png" alt="SmartConnect RX" style="height: 80px; margin-bottom: 15px;" />
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to SmartConnect RX</h1>
            </div>

            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hello Dr. ${lastName},
              </p>

              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your provider account has been successfully created! Please log in to complete your profile setup.
              </p>

              <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Your Login Credentials</h2>
                <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${appUrl}" style="color: #00AEEF;">${appUrl}</a></p>
                <p style="margin: 10px 0;"><strong>Username (Email):</strong> ${email}</p>
                <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 14px;">${password}</code></p>
              </div>

              <div style="background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #1E3A8A;">
                  <strong>📋 Next Steps:</strong>
                </p>
                <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #1E3A8A;">
                  <li style="margin-bottom: 8px;">Log in to your account using the credentials above</li>
                  <li style="margin-bottom: 8px;">Go to Settings → Profile to complete your provider information</li>
                  <li style="margin-bottom: 8px;">Add your payment details</li>
                  <li style="margin-bottom: 8px;">Add your addresses (physical and billing)</li>
                  <li>Change your temporary password for security</li>
                </ol>
              </div>

              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #92400E;">
                  <strong>⚠️ Security Notice:</strong> This is a temporary password. For your security, please change your password immediately after your first login by going to Settings → Security.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" style="display: inline-block; background: #1E3A8A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Log In to Portal
                </a>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
                If you have any questions or need assistance, please contact our support team at <a href="mailto:support@smartconnectrx.com" style="color: #00AEEF;">support@smartconnectrx.com</a>.
              </p>

              <p style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
                Best regards,<br>
                <strong>SmartConnect RX Team</strong>
              </p>
            </div>

            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} SmartConnect RX. All rights reserved.</p>
            </div>
          </div>
        `;

        const msg = {
          to: email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "noreply@smartconnectrx.com",
            name: process.env.SENDGRID_FROM_NAME || "SmartConnect RX"
          },
          subject: emailSubject,
          html: emailHtml,
        };

        await sgMail.send(msg);
      }

    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
      // Don't fail the entire request if email sending fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Doctor invited successfully. Welcome email sent with login credentials.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inviting doctor:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
