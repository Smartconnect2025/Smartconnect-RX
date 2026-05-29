import { createSeedClient } from "../client";

export async function seedAdmin() {
  try {
    const supabase = createSeedClient();

    // Admin user credentials
    const email = "h.alkhammal@gmail.com";
    const password = "Specode.123";

    // Create auth user using Supabase Admin API
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    let userId: string;

    if (authError) {
      // Check if user already exists
      if (authError.message?.includes("already been registered")) {
        // Get existing user
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.email === email,
        );
        if (existingUser) {
          userId = existingUser.id;
        } else {
          console.error(
            `Error finding existing admin user ${email}:`,
            authError,
          );
          throw authError;
        }
      } else {
        console.error(`Error creating admin user ${email}:`, authError);
        throw authError;
      }
    } else if (authData?.user) {
      userId = authData.user.id;
    } else {
      throw new Error("Failed to create or find admin user");
    }

    // Create or update admin role in user_roles table
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(
        {
          user_id: userId,
          role: "admin",
        },
        {
          onConflict: "user_id",
        },
      )
      .select()
      .single();

    if (roleError) {
      console.error("Error creating admin role:", roleError);
      throw roleError;
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
    throw error;
  }
}

export async function main() {
  await seedAdmin();
  process.exit(0);
}

// Run the seed if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
