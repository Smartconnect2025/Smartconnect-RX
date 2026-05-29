import { createSeedClient } from "../client";
import { providersData } from "./data/providers";
import type { Provider } from "../schema";

export async function seedProviders() {
  try {
    const supabase = createSeedClient();

    // Test connection first
    const { error: testError } = await supabase
      .from("providers")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("Database connection test failed:", testError);
      throw testError;
    }

    // First, create auth users for each provider
    const userIds: string[] = [];

    for (let i = 0; i < providersData.length; i++) {
      const email = `demo+provider${i + 1}@specode.ai`;
      const password = "Specode.123";

      // Create auth user using Supabase Admin API
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        // Check if user already exists
        if (authError.message?.includes("already been registered")) {
          // Get existing user
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(
            (u) => u.email === email,
          );
          if (existingUser) {
            userIds.push(existingUser.id);
          } else {
            console.error(`Error finding existing user ${email}:`, authError);
            throw authError;
          }
        } else {
          console.error(`Error creating auth user ${email}:`, authError);
          throw authError;
        }
      } else if (authData?.user) {
        userIds.push(authData.user.id);
      }
    }

    // Create provider roles in user_roles table
    for (const userId of userIds) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: userId,
            role: "provider",
          },
          {
            onConflict: "user_id",
          },
        )
        .select();

      if (roleError) {
        console.error(
          `Error creating provider role for user ${userId}:`,
          roleError,
        );
        throw roleError;
      }
    }

    // Prepare provider data with user_ids
    const providersWithUserIds = providersData.map((provider, index) => ({
      ...provider,
      user_id: userIds[index],
    }));

    // Insert provider data with user_ids
    const { data, error } = await supabase
      .from("providers")
      .insert(providersWithUserIds)
      .select();

    if (error) {
      // If error is due to duplicate data, that's okay for development seeding
      if (error.code === "23505") {
        // unique_violation
        return;
      }
      console.error("Insert error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error seeding providers:", error);
    throw error;
  }
}

export async function main() {
  await seedProviders();
  process.exit(0);
}

// Run the seed if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
