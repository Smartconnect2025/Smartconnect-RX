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
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import sgMail from "@sendgrid/mail";

export async function POST(request: NextRequest) {
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

    let pharmacyScope: { isPharmacyAdmin: boolean; pharmacyId: string | null } = { isPharmacyAdmin: false, pharmacyId: null };
    if (userRole !== "super_admin") {
      pharmacyScope = await getPharmacyAdminScope(user.id);
    }

    const body = await request.json();
    const { email, password, role, firstName, lastName, phone, tierLevel, groupId } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, role" },
        { status: 400 },
      );
    }

    // Validate role
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

    // Create the user account
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

    if (pharmacyScope.isPharmacyAdmin && pharmacyScope.pharmacyId && result.userId) {
      const supabase = createAdminClient();
      await supabase.from("provider_pharmacy_links").upsert({
        provider_id: result.userId,
        pharmacy_id: pharmacyScope.pharmacyId,
      }, { onConflict: "provider_id,pharmacy_id" });

      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("name")
        .eq("id", pharmacyScope.pharmacyId)
        .single();
      if (pharmacy) pharmacyName = pharmacy.name;
    }

    if (role === "provider") {
      try {
        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        if (sendGridApiKey) {
          sgMail.setApiKey(sendGridApiKey);

          const appUrl = "https://app.smartconnectrx.com/auth/login";
          const pharmacyLine = pharmacyName
            ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">You have been registered as a provider with <strong>${pharmacyName}</strong>.</p>`
            : "";

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <img src="https://smartconnectrx.com/logo-header.png" alt="SmartConnect RX" style="height: 80px; margin-bottom: 15px;" />
                <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to SmartConnect RX</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Prescriptions Made Simple</p>
              </div>

              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  Hello Dr. ${lastName},
                </p>

                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  Your provider account has been created on SmartConnect RX! Please log in and complete your profile to get started.
                </p>

                ${pharmacyLine}

                <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Your Login Credentials</h2>
                  <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${appUrl}" style="color: #00AEEF;">${appUrl}</a></p>
                  <p style="margin: 10px 0;"><strong>Username (Email):</strong> ${email}</p>
                  <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 14px;">${password}</code></p>
                </div>

                <div style="background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #1E3A8A;">
                    <strong>Next Steps:</strong>
                  </p>
                  <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #1E3A8A;">
                    <li style="margin-bottom: 8px;">Log in using the credentials above</li>
                    <li style="margin-bottom: 8px;">Complete your provider profile (NPI, medical license, etc.)</li>
                    <li style="margin-bottom: 8px;">Add your physical and billing addresses</li>
                    <li style="margin-bottom: 8px;">Add your payment/banking details</li>
                    <li style="margin-bottom: 8px;">Upload your digital signature</li>
                    <li>Change your temporary password for security</li>
                  </ol>
                </div>

                <div style="background: #FEF9C3; border-left: 4px solid #EAB308; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #854D0E;">
                    <strong>Important:</strong> Your account will remain inactive until your profile is reviewed and activated by the pharmacy. Please complete all required fields promptly.
                  </p>
                </div>

                <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #92400E;">
                    <strong>Security Notice:</strong> This is a temporary password. Please change it immediately after your first login by going to Settings &rarr; Security.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${appUrl}" style="display: inline-block; background: #1E3A8A; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Log In &amp; Complete Profile
                  </a>
                </div>

                <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
                  If you have any questions, contact our support team at <a href="mailto:support@smartconnectrx.com" style="color: #00AEEF;">support@smartconnectrx.com</a>.
                </p>

                <p style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
                  Best regards,<br>
                  <strong>SmartConnect RX Team</strong>
                </p>
              </div>

              <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
                <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} SmartConnect RX. All rights reserved.</p>
              </div>
            </div>
          `;

          await sgMail.send({
            to: email,
            from: {
              email: process.env.SENDGRID_FROM_EMAIL || "noreply@smartconnectrx.com",
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
