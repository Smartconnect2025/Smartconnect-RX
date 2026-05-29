import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@core/supabase";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "platform_owner"].includes(roleData.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // Find pending access request for this email
    const { data: accessRequest, error: findError } = await supabase
      .from("access_requests")
      .select("*")
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (findError || !accessRequest) {
      return NextResponse.json(
        { success: false, error: "No pending access request found for this email" },
        { status: 404 }
      );
    }

    // Update to approved
    const { error: updateError } = await supabase
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", accessRequest.id);

    if (updateError) {
      console.error("Error updating access request:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to approve access request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Access request approved successfully",
    });
  } catch (error) {
    console.error("Error approving access request:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
