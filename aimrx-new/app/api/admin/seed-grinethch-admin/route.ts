import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST() {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const supabase = createAdminClient();

  try {
    // Check if Greenwich pharmacy exists
    const { data: grinethchPharmacy } = await supabase
      .from("pharmacies")
      .select("id, name")
      .eq("slug", "grinethch")
      .single();

    if (!grinethchPharmacy) {
      return NextResponse.json(
        {
          success: false,
          error: "Greenwich pharmacy not found. Please seed Greenwich pharmacy first.",
        },
        { status: 400 }
      );
    }


    // Check if admin user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers.users.find(
      (u) => u.email === "grin_admin@grinethch.com"
    );

    let adminUserId: string;

    if (existingAdmin) {
      adminUserId = existingAdmin.id;

      // Check if link already exists
      const { data: existingLink } = await supabase
        .from("pharmacy_admins")
        .select("*")
        .eq("user_id", adminUserId)
        .eq("pharmacy_id", grinethchPharmacy.id)
        .single();

      if (existingLink) {
        return NextResponse.json({
          success: true,
          message: "Greenwich admin already seeded",
          user: { id: adminUserId, email: existingAdmin.email },
          pharmacy: grinethchPharmacy,
        });
      }
    } else {
      // Create admin user
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: "grin_admin@grinethch.com",
          password: "Grin2025!",
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
        pharmacy_id: grinethchPharmacy.id,
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
      message: "Greenwich admin seeded successfully",
      user: { id: adminUserId, email: "grin_admin@grinethch.com" },
      pharmacy: grinethchPharmacy,
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
