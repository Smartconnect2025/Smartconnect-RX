/**
 * Admin Users API
 *
 * Endpoint for admin users to create new admin and provider accounts
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { createUserAccount } from "@core/services/account-management";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { getPharmacyAdminScope, requireNonDemo, createGuardErrorResponse } from "@/core/auth/api-guards";
import sgMail from "@sendgrid/mail";
import { welcomeEmailHtml, calloutBox } from "@core/services/email/emailTemplates";

export async function POST(request: NextRequest) {
  try {
    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

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

    let pharmacyScope: { isPharmacyAdmin: boolean; pharmacyId: string | null } = { isPharmacyAdmin: false, pharmacyId: null };
    if (userRole !== "super_admin") {
      pharmacyScope = await getPharmacyAdminScope(user.id);
    }

    if (pharmacyScope.isPharmacyAdmin && !pharmacyScope.pharmacyId) {
      return NextResponse.json(
        { error: "Unable to determine pharmacy scope" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email, password, role, firstName, lastName, phone, tierLevel, groupId, pharmacyId: explicitPharmacyId } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, role" },
        { status: 400 },
      );
    }

    if (!["admin", "provider"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'provider'" },
        { status: 400 },
      );
    }

    if (pharmacyScope.isPharmacyAdmin && role === "admin") {
      return NextResponse.json(
        { error: "Pharmacy admins cannot create other admin accounts" },
        { status: 403 },
      );
    }

    const result = await createUserAccount({
      email,
      password,
      role,
      firstName,
      lastName,
      phone,
      tierLevel,
      groupId,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    let pharmacyName: string | null = null;
    const linkPharmacyId = pharmacyScope.isPharmacyAdmin && pharmacyScope.pharmacyId
      ? pharmacyScope.pharmacyId
      : (!pharmacyScope.isPharmacyAdmin ? explicitPharmacyId : null) || null;

    if (linkPharmacyId && result.userId && role === "provider") {
      const supabase = createAdminClient();
      const { error: linkError } = await supabase.from("provider_pharmacy_links").upsert({
        provider_id: result.userId,
        pharmacy_id: linkPharmacyId,
      }, { onConflict: "provider_id,pharmacy_id" });

      if (linkError) {
        console.error("Failed to link provider to pharmacy:", linkError);
        return NextResponse.json(
          { error: "Account created but failed to link to pharmacy. Please link manually.", userId: result.userId },
          { status: 207 },
        );
      }

      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("name")
        .eq("id", linkPharmacyId)
        .single();
      if (pharmacy) pharmacyName = pharmacy.name;
    }

    if (role === "provider") {
      try {
        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        if (sendGridApiKey) {
          sgMail.setApiKey(sendGridApiKey);

          const pharmacyMsg = pharmacyName ? ` You have been registered as a provider with <strong>${pharmacyName}</strong>.` : "";
          const nextSteps = `
            <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #1E3A8A;">
              <li style="margin-bottom: 8px;">Log in using the credentials above</li>
              <li style="margin-bottom: 8px;">Complete your provider profile (NPI, medical license, etc.)</li>
              <li style="margin-bottom: 8px;">Add your physical and billing addresses</li>
              <li style="margin-bottom: 8px;">Add your payment/banking details</li>
              <li style="margin-bottom: 8px;">Upload your digital signature</li>
              <li>Change your temporary password for security</li>
            </ol>
          `;
          const emailHtml = welcomeEmailHtml({
            greeting: `Hello Dr. ${lastName},`,
            message: `Your provider account has been created on SmartConnect RX! Please log in and complete your profile to get started.${pharmacyMsg}`,
            email,
            tempPassword: password,
            extraContent: calloutBox(`<p style="margin: 0 0 10px; font-size: 14px; color: #1E3A8A;"><strong>Next Steps:</strong></p>${nextSteps}`) +
              calloutBox(`<p style="margin: 0; font-size: 13px; color: #334155;"><strong>Important:</strong> Your account will remain inactive until your profile is reviewed and activated. Please complete all required fields promptly.</p>`, "#0284C7", "#E0F2FE"),
          });

          await sgMail.send({
            to: email,
            from: {
              email: process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com",
              name: process.env.SENDGRID_FROM_NAME || "SmartConnect RX",
            },
            subject: "Welcome to SmartConnect RX - Complete Your Provider Profile",
            html: emailHtml,
          });
        }
      } catch (emailError) {
        console.error("Error sending provider welcome email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      message: role === "provider"
        ? `Provider account created. Welcome email sent to ${email} with login credentials.`
        : `Successfully created ${role} account`,
    });
  } catch (error) {
    console.error("Error creating user account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
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

    if (userRole !== "super_admin") {
      const scope = await getPharmacyAdminScope(user.id);
      if (scope.isPharmacyAdmin) {
        return NextResponse.json(
          { error: "This action is restricted to platform administrators" },
          { status: 403 },
        );
      }
    }

    // Get all users with their roles and profiles
    const supabase = createAdminClient();

    // Get all auth users
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      return NextResponse.json(
        { error: "Failed to fetch user roles" },
        { status: 500 },
      );
    }

    // Get provider profiles
    const { data: providerProfiles, error: providerError } = await supabase
      .from("providers")
      .select("*");

    if (providerError) {
      console.error("Error fetching provider profiles:", providerError);
      return NextResponse.json(
        { error: "Failed to fetch provider profiles" },
        { status: 500 },
      );
    }

    // Combine the data
    const users = authUsers.users.map((authUser) => {
      const userRole = userRoles?.find((ur) => ur.user_id === authUser.id);
      const providerProfile = providerProfiles?.find(
        (pp) => pp.user_id === authUser.id,
      );

      return {
        id: authUser.id,
        email: authUser.email,
        role: userRole?.role || "user",
        firstName: providerProfile?.first_name || null,
        lastName: providerProfile?.last_name || null,
        phone: providerProfile?.phone_number || null,
        createdAt: authUser.created_at,
        lastSignIn: authUser.last_sign_in_at,
        status: authUser.confirmed_at ? "active" : "inactive",
      };
    });

    return NextResponse.json({
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
