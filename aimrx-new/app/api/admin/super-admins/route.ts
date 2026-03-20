import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import sgMail from "@sendgrid/mail";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const scope = await getPharmacyAdminScope(user.id);
  if (scope.isPharmacyAdmin) {
    return NextResponse.json({ error: "This action is restricted to platform administrators" }, { status: 403 });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const { data: adminRoles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");

    if (error) {
      console.error("Error querying user_roles:", error);
      return NextResponse.json({ error: "Failed to fetch admins", details: error.message }, { status: 500 });
    }

    const admins = await Promise.all(
      (adminRoles || []).map(async (role) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(role.user_id);

        const { data: pharmacyLinks } = await supabaseAdmin
          .from("pharmacy_admins")
          .select("pharmacy_id, pharmacies(id, name, slug)")
          .eq("user_id", role.user_id);

        return {
          user_id: role.user_id,
          email: userData?.user?.email || "Unknown",
          full_name: userData?.user?.user_metadata?.full_name
            || (userData?.user?.user_metadata?.first_name
              ? `${userData?.user?.user_metadata?.first_name} ${userData?.user?.user_metadata?.last_name || ""}`.trim()
              : null),
          created_at: userData?.user?.created_at || null,
          last_sign_in: userData?.user?.last_sign_in_at || null,
          email_confirmed: !!userData?.user?.email_confirmed_at,
          pharmacies: pharmacyLinks || [],
          is_current_user: role.user_id === user.id,
        };
      })
    );

    admins.sort((a, b) => {
      if (a.is_current_user) return -1;
      if (b.is_current_user) return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return NextResponse.json({ success: true, admins });
  } catch (error) {
    console.error("Error fetching super admins:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const postScope = await getPharmacyAdminScope(user.id);
  if (postScope.isPharmacyAdmin) {
    return NextResponse.json({ error: "This action is restricted to platform administrators" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, full_name, pharmacy_ids } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split("@")[0],
      },
    });

    if (authError || !authData.user) {
      const isDuplicate =
        authError?.code === "user_already_exists" ||
        authError?.code === "email_exists" ||
        (authError as { status?: number })?.status === 422 ||
        authError?.message?.toLowerCase().includes("already") ||
        authError?.message?.toLowerCase().includes("exists");

      return NextResponse.json(
        { error: isDuplicate ? "A user with this email already exists" : authError?.message || "Failed to create user" },
        { status: isDuplicate ? 400 : 500 }
      );
    }

    const userId = authData.user.id;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Failed to assign admin role" }, { status: 500 });
    }

    if (pharmacy_ids && pharmacy_ids.length > 0) {
      const pharmacyInserts = pharmacy_ids.map((pid: string) => ({
        user_id: userId,
        pharmacy_id: pid,
      }));
      const { error: linkError } = await supabaseAdmin
        .from("pharmacy_admins")
        .insert(pharmacyInserts);
      if (linkError) {
        console.error("Error linking pharmacies:", linkError);
      }
    }

    try {
      const sendGridApiKey = process.env.SENDGRID_API_KEY;

      if (sendGridApiKey) {
        sgMail.setApiKey(sendGridApiKey);

        const appUrl = "https://app.smartconnectrx.com/auth/login";
        const displayName = full_name || email.split("@")[0];

        let pharmacyNames = "all pharmacies";
        if (pharmacy_ids && pharmacy_ids.length > 0) {
          const { data: pharmacies } = await supabaseAdmin
            .from("pharmacies")
            .select("name")
            .in("id", pharmacy_ids);
          if (pharmacies && pharmacies.length > 0) {
            pharmacyNames = pharmacies.map((p: { name: string }) => p.name).join(", ");
          }
        }

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <img src="https://smartconnectrx.com/logo-header.png" alt="SmartConnect RX" style="height: 80px; margin-bottom: 15px;" />
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to SmartConnect RX</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hello ${displayName},
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your <strong>Platform Super Admin</strong> account has been created! You now have full access to manage ${pharmacyNames}, providers, medications, and platform settings.
              </p>
              <div style="background: white; border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h2 style="color: #1E3A8A; margin-top: 0; font-size: 18px;">Your Login Credentials</h2>
                <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${appUrl}" style="color: #00AEEF;">${appUrl}</a></p>
                <p style="margin: 10px 0;"><strong>Username (Email):</strong> ${email}</p>
                <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 14px;">${password}</code></p>
              </div>
              <div style="background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
                  <strong>Your Access Level:</strong> Platform Super Admin — you can manage all pharmacies, invite providers, view all prescriptions and orders, and create other admin accounts.
                </p>
              </div>
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #92400E;">
                  <strong>Security Notice:</strong> Please keep these credentials secure. We recommend changing your password after your first login by going to Settings.
                </p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" style="display: inline-block; background: #1E3A8A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Log In to Portal
                </a>
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
                If you have any questions, contact support at <a href="mailto:support@smartconnectrx.com" style="color: #00AEEF;">support@smartconnectrx.com</a>.
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

        const msg = {
          to: email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "noreply@smartconnectrx.com",
            name: process.env.SENDGRID_FROM_NAME || "SmartConnect RX",
          },
          subject: "Welcome to SmartConnect RX - Super Admin Account Created",
          html: emailHtml,
        };

        await sgMail.send(msg);
      }
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Super admin created successfully",
      admin: {
        user_id: userId,
        email,
        full_name: full_name || null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating super admin:", error);
    return NextResponse.json(
      { error: "Failed to create super admin", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const scope = await getPharmacyAdminScope(user.id);
  if (scope.isPharmacyAdmin) {
    return NextResponse.json({ error: "This action is restricted to platform administrators" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { user_id, full_name, new_password, pharmacy_ids } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) {
      updateData.user_metadata = { full_name };
    }
    if (new_password) {
      updateData.password = new_password;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, updateData);
      if (updateError) {
        console.error("Error updating user:", updateError);
        return NextResponse.json(
          { error: "Failed to update user", details: updateError.message },
          { status: 500 }
        );
      }
    }

    if (pharmacy_ids !== undefined) {
      await supabaseAdmin
        .from("pharmacy_admins")
        .delete()
        .eq("user_id", user_id);

      if (pharmacy_ids.length > 0) {
        const pharmacyInserts = pharmacy_ids.map((pid: string) => ({
          user_id,
          pharmacy_id: pid,
        }));
        const { error: linkError } = await supabaseAdmin
          .from("pharmacy_admins")
          .insert(pharmacyInserts);
        if (linkError) {
          console.error("Error linking pharmacies:", linkError);
          return NextResponse.json(
            { error: "Failed to update pharmacy links", details: linkError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Admin updated successfully",
    });
  } catch (error) {
    console.error("Error updating super admin:", error);
    return NextResponse.json(
      { error: "Failed to update admin", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const deleteScope = await getPharmacyAdminScope(user.id);
  if (deleteScope.isPharmacyAdmin) {
    return NextResponse.json({ error: "This action is restricted to platform administrators" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    if (user_id === user.id) {
      return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { error: roleDeleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user_id)
      .eq("role", "admin");

    if (roleDeleteError) {
      console.error("Error removing admin role:", roleDeleteError);
      return NextResponse.json(
        { error: "Failed to remove admin role", details: roleDeleteError.message },
        { status: 500 }
      );
    }

    const { error: pharmacyDeleteError } = await supabaseAdmin
      .from("pharmacy_admins")
      .delete()
      .eq("user_id", user_id);

    if (pharmacyDeleteError) {
      console.error("Error removing pharmacy links:", pharmacyDeleteError);
    }

    return NextResponse.json({
      success: true,
      message: "Admin access removed successfully",
    });
  } catch (error) {
    console.error("Error removing super admin:", error);
    return NextResponse.json(
      { error: "Failed to remove admin", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
