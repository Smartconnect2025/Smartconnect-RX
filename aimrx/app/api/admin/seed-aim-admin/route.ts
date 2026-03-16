import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * Seed AIM Admin User
 * POST /api/admin/seed-aim-admin
 */
export async function POST() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    // Check if AIM pharmacy exists
    const { data: aimPharmacy } = await supabase
      .from("pharmacies")
      .select("id, name")
      .eq("slug", "aim")
      .single();

    if (!aimPharmacy) {
      return NextResponse.json(
        {
          success: false,
          error: "AIM pharmacy not found. Please seed AIM pharmacy first.",
        },
        { status: 400 }
      );
    }


    // Check if admin user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers.users.find(
      (u) => u.email === "aim_admin@aimmedtech.com"
    );

    let adminUserId: string;

    if (existingAdmin) {
      adminUserId = existingAdmin.id;

      // Check if link already exists
      const { data: existingLink } = await supabase
        .from("pharmacy_admins")
        .select("*")
        .eq("user_id", adminUserId)
        .eq("pharmacy_id", aimPharmacy.id)
        .single();

      if (existingLink) {
        return NextResponse.json({
          success: true,
          message: "AIM admin already seeded",
          user: { id: adminUserId, email: existingAdmin.email },
          pharmacy: aimPharmacy,
        });
      }
    } else {
      // Create admin user
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: "aim_admin@aimmedtech.com",
          password: "AIM2025!",
          email_confirm: true,
        });

      if (createError || !newUser.user) {
        console.error("❌ Error creating user:", createError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to create admin user",
            details: createError,
          },
          { status: 500 }
        );
      }

      adminUserId = newUser.user.id;
    }

    // Link admin to pharmacy
    const { data: link, error: linkError } = await supabase
      .from("pharmacy_admins")
      .insert({
        user_id: adminUserId,
        pharmacy_id: aimPharmacy.id,
      })
      .select()
      .single();

    if (linkError) {
      console.error("❌ Error linking admin to pharmacy:", linkError);
      return NextResponse.json(
        {
          success: false,
          error: "User created but linking failed",
          details: linkError,
        },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      message: "AIM admin seeded successfully",
      user: { id: adminUserId, email: "aim_admin@aimmedtech.com" },
      pharmacy: aimPharmacy,
      link,
    });
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Seeding failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
