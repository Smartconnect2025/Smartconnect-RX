import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST() {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const supabase = createAdminClient();

  try {
    // Get both pharmacies
    const { data: pharmacies } = await supabase
      .from("pharmacies")
      .select("id, slug, name")
      .in("slug", ["aim", "grinethch"]);

    let aimPharmacy = pharmacies?.find((p) => p.slug === "aim");
    let grinethchPharmacy = pharmacies?.find((p) => p.slug === "grinethch");

    // If pharmacies don't exist, create them first
    if (!aimPharmacy || !grinethchPharmacy) {

      // Create AIM if missing
      if (!aimPharmacy) {
        const { data: newAim, error: aimError } = await supabase
          .from("pharmacies")
          .insert({
            name: "SmartConnect RX",
            slug: "aim",
            primary_color: "#00AEEF",
            tagline: "Prescriptions Made Simple",
            is_active: true,
          })
          .select()
          .single();

        if (aimError) {
          throw new Error(`Failed to create AIM pharmacy: ${aimError.message}`);
        }
        aimPharmacy = newAim;
      }

      // Create Greenwich if missing
      if (!grinethchPharmacy) {
        const { data: newGrin, error: grinError } = await supabase
          .from("pharmacies")
          .insert({
            name: "Greenwich Pharmacy",
            slug: "grinethch",
            primary_color: "#228B22",
            tagline: "Your Neighborhood Health Partner",
            is_active: true,
          })
          .select()
          .single();

        if (grinError) {
          throw new Error(`Failed to create Greenwich pharmacy: ${grinError.message}`);
        }
        grinethchPharmacy = newGrin;
      }
    }

    // Ensure both pharmacies exist at this point
    if (!aimPharmacy || !grinethchPharmacy) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create or find pharmacies",
        },
        { status: 500 }
      );
    }

    const results = [];

    // Force seed AIM admin
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingAim = existingUsers.users.find(
        (u) => u.email === "aim_admin@aimmedtech.com"
      );

      let aimUserId: string;

      if (existingAim) {
        // Update password
        await supabase.auth.admin.updateUserById(existingAim.id, {
          password: "AIM2025!",
        });
        aimUserId = existingAim.id;
      } else {
        // Create new user
        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email: "aim_admin@aimmedtech.com",
            password: "AIM2025!",
            email_confirm: true,
          });

        if (createError || !newUser.user) {
          throw createError;
        }

        aimUserId = newUser.user.id;
      }

      // Delete existing link if any
      await supabase
        .from("pharmacy_admins")
        .delete()
        .eq("user_id", aimUserId);

      // Create fresh pharmacy_admins link
      const { error: linkError } = await supabase
        .from("pharmacy_admins")
        .insert({
          user_id: aimUserId,
          pharmacy_id: aimPharmacy.id,
        });

      if (linkError) throw linkError;

      // Set user role to admin in user_roles table
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", aimUserId);

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: aimUserId,
          role: "admin",
        });


      results.push({
        pharmacy: "SmartConnect RX",
        email: "aim_admin@aimmedtech.com",
        status: "success",
      });
    } catch (error) {
      results.push({
        pharmacy: "SmartConnect RX",
        email: "aim_admin@aimmedtech.com",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Force seed Greenwich admin
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingGrin = existingUsers.users.find(
        (u) => u.email === "grin_admin@grinethch.com"
      );

      let grinUserId: string;

      if (existingGrin) {
        // Update password
        await supabase.auth.admin.updateUserById(existingGrin.id, {
          password: "Grin2025!",
        });
        grinUserId = existingGrin.id;
      } else {
        // Create new user
        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email: "grin_admin@grinethch.com",
            password: "Grin2025!",
            email_confirm: true,
          });

        if (createError || !newUser.user) {
          throw createError;
        }

        grinUserId = newUser.user.id;
      }

      // Delete existing link if any
      await supabase
        .from("pharmacy_admins")
        .delete()
        .eq("user_id", grinUserId);

      // Create fresh pharmacy_admins link
      const { error: linkError } = await supabase
        .from("pharmacy_admins")
        .insert({
          user_id: grinUserId,
          pharmacy_id: grinethchPharmacy.id,
        });

      if (linkError) throw linkError;

      // Set user role to admin in user_roles table
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", grinUserId);

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: grinUserId,
          role: "admin",
        });


      results.push({
        pharmacy: "Greenwich Pharmacy",
        email: "grin_admin@grinethch.com",
        status: "success",
      });
    } catch (error) {
      results.push({
        pharmacy: "Greenwich Pharmacy",
        email: "grin_admin@grinethch.com",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const allSuccess = results.every((r) => r.status === "success");

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? "Pharmacies + admins seeded successfully"
        : "Some admins failed to seed",
      results,
      pharmaciesCreated: !pharmacies || pharmacies.length < 2,
    });
  } catch (error) {
    console.error("❌ Force-seeding failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Force-seeding failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
