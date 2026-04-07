import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import sgMail from "@sendgrid/mail";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import { insertUserRole } from "@core/database/insert-user-role";
import { welcomeEmailHtml, calloutBox } from "@core/services/email/emailTemplates";

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
    const { firstName, lastName, email, phone, password, tierLevel, groupId, companyName, physicalAddress, billingAddress, accessRequestId } = body;
    let { npiNumber, medicalLicense, licenseState, referringPharmacyId } = body;
    const { pharmacyId } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createAdminClient();

    if (accessRequestId) {
      const { data: accessReq } = await supabaseAdmin
        .from("access_requests")
        .select("email, type, form_data")
        .eq("id", accessRequestId)
        .eq("type", "doctor")
        .single();

      if (accessReq && accessReq.email?.toLowerCase() === email.toLowerCase() && accessReq.form_data) {
        const fd = accessReq.form_data;
        if (!npiNumber && fd.npiNumber) npiNumber = fd.npiNumber;
        if (!medicalLicense && fd.medicalLicense) medicalLicense = fd.medicalLicense;
        if (!licenseState && fd.licenseState) licenseState = fd.licenseState;
        if (!referringPharmacyId && fd.referringPharmacyId) referringPharmacyId = fd.referringPharmacyId;
      }
    } else if (email && !npiNumber) {
      const { data: accessReq } = await supabaseAdmin
        .from("access_requests")
        .select("form_data")
        .eq("email", email.toLowerCase())
        .eq("type", "doctor")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (accessReq?.form_data) {
        const fd = accessReq.form_data;
        if (!npiNumber && fd.npiNumber) npiNumber = fd.npiNumber;
        if (!medicalLicense && fd.medicalLicense) medicalLicense = fd.medicalLicense;
        if (!licenseState && fd.licenseState) licenseState = fd.licenseState;
        if (!referringPharmacyId && fd.referringPharmacyId) referringPharmacyId = fd.referringPharmacyId;
      }
    }

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

    const roleResult = await insertUserRole(authUser.user.id, "provider", supabaseAdmin);

    if (!roleResult.success) {
      console.error("Error creating user role:", roleResult.error);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        {
          error: "Failed to create user role",
          details: roleResult.error || "Unknown error"
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
      } else {
        const resolvedId = pharmacyId || referringPharmacyId;
        if (!resolvedId) {
          console.error("Super admin invite missing pharmacyId");
          await supabaseAdmin.from("providers").delete().eq("id", providerData.id);
          await supabaseAdmin.from("user_roles").delete().eq("user_id", authUser.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json(
            { error: "Pharmacy selection is required" },
            { status: 400 }
          );
        }

        const { data: validPharmacy } = await supabaseAdmin
          .from("pharmacies")
          .select("id")
          .eq("id", resolvedId)
          .eq("is_active", true)
          .single();

        if (validPharmacy) {
          pharmacyIdToLink = validPharmacy.id;
        } else {
          console.error("Invalid pharmacy ID:", resolvedId);
          await supabaseAdmin.from("providers").delete().eq("id", providerData.id);
          await supabaseAdmin.from("user_roles").delete().eq("user_id", authUser.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json(
            { error: "Selected pharmacy not found or inactive" },
            { status: 400 }
          );
        }
      }

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

      if (companyName && pharmacyIdToLink) {
        try {
          const { data: pharmacyLinks } = await supabaseAdmin
            .from("provider_pharmacy_links")
            .select("provider_id")
            .eq("pharmacy_id", pharmacyIdToLink);

          const pharmacyUserIds = (pharmacyLinks || []).map((l: { provider_id: string }) => l.provider_id);

          if (pharmacyUserIds.length > 0) {
            const { data: companyProviders } = await supabaseAdmin
              .from("providers")
              .select("id")
              .eq("company_name", companyName)
              .neq("id", providerData.id)
              .in("user_id", pharmacyUserIds);

            if (companyProviders && companyProviders.length > 0) {
              const companyProviderIds = companyProviders.map((p: { id: string }) => p.id);

              const { data: companyPatients } = await supabaseAdmin
                .from("patients")
                .select("id")
                .in("provider_id", companyProviderIds);

              if (companyPatients && companyPatients.length > 0) {
                const newMappings = companyPatients.map((p: { id: string }) => ({
                  provider_id: providerData.id,
                  patient_id: p.id,
                }));

                await supabaseAdmin
                  .from("provider_patient_mappings")
                  .upsert(newMappings, { onConflict: "provider_id,patient_id" });
              }
            }
          }
        } catch (syncError) {
          console.error("Non-fatal: Error syncing company patients on invite:", syncError);
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

        const emailSubject = "Welcome to SmartConnect RX - Your Provider Account";
        const nextSteps = `
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #1E3A8A;">
            <li style="margin-bottom: 8px;">Log in to your account using the credentials above</li>
            <li style="margin-bottom: 8px;">Go to Settings → Profile to complete your provider information</li>
            <li style="margin-bottom: 8px;">Add your NPI number and medical license</li>
            <li style="margin-bottom: 8px;">Add your addresses (physical and billing)</li>
            <li>Change your temporary password for security</li>
          </ol>
        `;
        const emailHtml = welcomeEmailHtml({
          greeting: `Hello Dr. ${lastName},`,
          message: "Your provider account has been successfully created! Please log in to complete your profile setup.",
          email,
          tempPassword: password,
          extraContent: calloutBox(`<p style="margin: 0 0 10px; font-size: 14px; color: #1E3A8A;"><strong>📋 Next Steps:</strong></p>${nextSteps}`) +
            calloutBox(`<p style="margin: 0; font-size: 13px; color: #334155;">Our team will review your NPI and credentials. Your account will be fully activated once verification is complete.</p>`, "#0284C7", "#E0F2FE"),
        });

        const msg = {
          to: email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
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
