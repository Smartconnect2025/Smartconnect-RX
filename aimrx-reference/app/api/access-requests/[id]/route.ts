import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

/**
 * Approve or reject an access request
 * PATCH /api/access-requests/[id]
 * Body: { action: 'approve' | 'reject', rejectionReason?: string, password?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const supabaseAdmin = await createAdminClient();
    const { id: requestId } = await params;

    // Check authentication
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

    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || !userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, rejectionReason } = body;

    if (!action || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get the access request
    const { data: accessRequest, error: fetchError } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !accessRequest) {
      return NextResponse.json(
        { success: false, error: "Access request not found" },
        { status: 404 }
      );
    }

    if (accessRequest.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `Request has already been ${accessRequest.status}` },
        { status: 400 }
      );
    }

    if (action === "reject") {
      // Update request status to rejected
      const { error: updateError } = await supabaseAdmin
        .from("access_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("Error updating access request:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to reject request" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Access request rejected successfully",
      });
    }

    // Handle approval - just mark as approved (welcome email with credentials sent by invite-doctor API)
    if (action === "approve") {
      // Update access request status to approved
      const { error: updateError } = await supabaseAdmin
        .from("access_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("Error updating access request:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to approve request" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Access request marked as approved",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing access request action:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
