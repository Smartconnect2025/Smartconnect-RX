import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * Create MFA codes table
 * GET /api/admin/create-mfa-table
 */
export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    // Create mfa_codes table
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS mfa_codes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          user_id uuid NOT NULL,
          code text NOT NULL,
          expires_at timestamp with time zone NOT NULL,
          is_used boolean DEFAULT false NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL
        );
      `,
    });

    if (error) {
      console.error("Error creating table:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "MFA codes table created successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
