import { createAdminClient } from "@core/database/client";

export async function insertUserRole(
  userId: string,
  role: string,
  supabaseAdmin?: ReturnType<typeof createAdminClient>
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseAdmin || createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: maxIdRow } = await client
      .from("user_roles")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    const nextId = Number(maxIdRow?.id ?? 0) + 1;

    const { error } = await client.from("user_roles").insert({
      id: nextId,
      user_id: userId,
      role,
    });

    if (!error) return { success: true };

    if (error.message?.includes("duplicate") || error.code === "23505") {
      continue;
    }

    return { success: false, error: error.message };
  }

  return { success: false, error: "Failed after 3 retry attempts (concurrent ID conflicts)" };
}
