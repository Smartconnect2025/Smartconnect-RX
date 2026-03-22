import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import sgMail from "@sendgrid/mail";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import { insertUserRole } from "@core/database/insert-user-role";

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();

  try {
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

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "Only platform administrators can manage pharmacy admin assignments" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, password, pharmacy_id, full_name } = body;

    // Validate required fields
    if (!email || !password || !pharmacy_id) {
      return NextResponse.json(
        { success: false, error: "Email, password, and pharmacy_id are required" },
        { status: 400 }
      );
    }

    const { data: { users: existingUsers } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.find((u: { email?: string }) => u.email === email);
    if (existingUser) {
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingRole && ["admin", "super_admin"].includes(existingRole.role)) {
        return NextResponse.json(
          {
            success: false,
            error: "This email belongs to a platform admin. A user cannot have two roles — they cannot be both a platform admin and a pharmacy admin.",
          },
          { status: 400 },
        );
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split("@")[0],
      },
    });

    if (authError || !authData.user) {
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
          success: false,
          error: isDuplicate
            ? "A user with this email already exists. Please use a different email address."
            : "Failed to create user account",
          details: authError?.message || "Unknown error",
        },
        { status: isDuplicate ? 400 : 500 }
      );
    }

    const userId = authData.user.id;

    const roleResult = await insertUserRole(userId, "admin", supabaseAdmin);
    if (!roleResult.success) {
      console.error("Error creating user role:", roleResult.error);
      await supabaseAdmin
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", userId);
    }

    const { error: linkError } = await supabaseAdmin
      .from("pharmacy_admins")
      .insert({
        user_id: userId,
        pharmacy_id,
      });

    if (linkError) {
      console.error("Error linking user to pharmacy:", linkError);
      // Cleanup: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to link user to pharmacy",
          details: linkError.message,
        },
        { status: 500 }
      );
    }

    const { data: pharmacy } = await supabaseAdmin
      .from("pharmacies")
      .select("name, slug")
      .eq("id", pharmacy_id)
      .single();

    // 5. Send confirmation email with credentials
    try {
      const sendGridApiKey = process.env.SENDGRID_API_KEY;

      if (sendGridApiKey) {
        sgMail.setApiKey(sendGridApiKey);

        const appUrl = "https://app.smartconnectrx.com/auth/login";
        const pharmacyName = pharmacy?.name || "the pharmacy";

        const emailSubject = "Welcome to SmartConnect RX - Pharmacy Admin Account Created";
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <img src="https://smartconnectrx.com/logo-header.png" alt="SmartConnect RX" style="height: 80px; margin-bottom: 15px;" />
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to SmartConnect RX</h1>
            </div>

            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hello${full_name ? ` ${full_name}` : ""},
              </p>

              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your pharmacy administrator account has been successfully created for <strong>${pharmacyName}</strong>! You can now access SmartConnect RX to manage pharmacy operations, prescriptions, and settings.
              </p>

              <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Your Login Credentials</h2>
                <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${appUrl}" style="color: #00AEEF;">${appUrl}</a></p>
                <p style="margin: 10px 0;"><strong>Pharmacy:</strong> ${pharmacyName}</p>
                <p style="margin: 10px 0;"><strong>Username (Email):</strong> ${email}</p>
                <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 14px;">${password}</code></p>
              </div>

              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #92400E;">
                  <strong>⚠️ Security Notice:</strong> Please keep these credentials secure. We recommend changing your password after your first login by going to Settings → Security.
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
            name: process.env.SENDGRID_FROM_NAME || "SmartConnect RX",
          },
          subject: emailSubject,
          html: emailHtml,
        };

        await sgMail.send(msg);
      } else {
      }
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Don't fail the entire request if email sending fails
    }

    return NextResponse.json({
      success: true,
      message: `Pharmacy admin created successfully for ${pharmacy?.name || "pharmacy"}`,
      user: {
        id: userId,
        email,
        pharmacy: pharmacy?.name,
      },
    });
  } catch (error) {
    console.error("Error in create pharmacy admin:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create pharmacy admin",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Delete a pharmacy admin
 * DELETE /api/admin/pharmacy-admins
 */
export async function DELETE(request: Request) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();

  try {
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

    const deleteScope = await getPharmacyAdminScope(user.id);
    if (deleteScope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "Only platform administrators can manage pharmacy admin assignments" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { user_id, pharmacy_id } = body;

    // Validate required fields
    if (!user_id || !pharmacy_id) {
      return NextResponse.json(
        { success: false, error: "user_id and pharmacy_id are required" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("pharmacy_admins")
      .delete()
      .eq("user_id", user_id)
      .eq("pharmacy_id", pharmacy_id);

    if (deleteError) {
      console.error("Error deleting pharmacy admin link:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to remove admin from pharmacy",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    const { data: remainingLinks } = await supabaseAdmin
      .from("pharmacy_admins")
      .select("user_id")
      .eq("user_id", user_id);

    if (!remainingLinks || remainingLinks.length === 0) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", "admin");

      // Delete the auth user
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteUserError) {
        console.error("Error deleting auth user:", deleteUserError);
        // Don't fail the request, the link was already removed
      }
    }

    return NextResponse.json({
      success: true,
      message: "Pharmacy admin removed successfully",
    });
  } catch (error) {
    console.error("Error in delete pharmacy admin:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete pharmacy admin",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Get all pharmacy admins
 * GET /api/admin/pharmacy-admins
 */
export async function GET() {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();

  try {
    const {
      data: { user: getUser },
    } = await supabase.auth.getUser();
    if (getUser) {
      const getScope = await getPharmacyAdminScope(getUser.id);
      if (getScope.isPharmacyAdmin) {
        return NextResponse.json(
          { success: false, error: "Only platform administrators can view pharmacy admin assignments" },
          { status: 403 }
        );
      }
    }

    const { data: adminLinks, error } = await supabaseAdmin
      .from("pharmacy_admins")
      .select(`
        user_id,
        pharmacy_id,
        created_at,
        pharmacy:pharmacies(name, slug, primary_color)
      `);

    if (error) {
      console.error("Error fetching pharmacy admins:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch pharmacy admins" },
        { status: 500 }
      );
    }

    // Get user details for each admin
    const adminsWithDetails = await Promise.all(
      (adminLinks || []).map(async (link) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(link.user_id);
        return {
          user_id: link.user_id,
          email: userData?.user?.email || "Unknown",
          full_name: userData?.user?.user_metadata?.full_name || null,
          pharmacy_id: link.pharmacy_id,
          pharmacy: link.pharmacy,
          created_at: link.created_at,
        };
      })
    );

    return NextResponse.json({
      success: true,
      admins: adminsWithDetails,
    });
  } catch (error) {
    console.error("Error in get pharmacy admins:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pharmacy admins",
      },
      { status: 500 }
    );
  }
}
