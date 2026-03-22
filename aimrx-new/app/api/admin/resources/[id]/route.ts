/**
 * Admin Individual Resource API
 *
 * Endpoint for admin users to update and delete specific resources
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { updateTagUsageCounts } from "@/features/admin-dashboard/utils/tagUsageUpdater";
import { requireAnyAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminCheck = await requireAnyAdmin();
    if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, url, content, type, tags, cover_src } = body;

    // Validate required fields
    if (!title || !description || !type) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, type" },
        { status: 400 },
      );
    }

    // Validation by type
    if ((type === "Video" || type === "Link") && !url) {
      return NextResponse.json(
        { error: "URL is required for Video and Link resources" },
        { status: 400 },
      );
    }
    if (type === "Text Content" && !content) {
      return NextResponse.json(
        { error: "Content is required for Text Content resources" },
        { status: 400 },
      );
    }

    // Validate type
    if (!["PDF", "Article", "Video", "Link", "Text Content"].includes(type)) {
      return NextResponse.json(
        {
          error:
            "Invalid type. Must be 'PDF', 'Article', 'Video', 'Link', or 'Text Content'",
        },
        { status: 400 },
      );
    }

    const supabase = createClient();

    // Update the resource
    const { data, error } = await supabase
      .from("resources")
      .update({
        title,
        description,
        url: url ?? null,
        content: content ?? null,
        type,
        tags: tags || [],
        cover_src: cover_src || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating resource:", error);
      return NextResponse.json(
        { error: "Failed to update resource" },
        { status: 500 },
      );
    }

    // Update tag usage counts after updating resource
    await updateTagUsageCounts();

    return NextResponse.json({
      success: true,
      resource: data,
      message: "Resource updated successfully",
    });
  } catch (error) {
    console.error("Error updating resource:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminCheck = await requireAnyAdmin();
    if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

    const { id } = await params;
    const supabase = createClient();

    // Delete the resource
    const { error } = await supabase.from("resources").delete().eq("id", id);

    if (error) {
      console.error("Error deleting resource:", error);
      return NextResponse.json(
        { error: "Failed to delete resource" },
        { status: 500 },
      );
    }

    // Update tag usage counts after deleting resource
    await updateTagUsageCounts();

    return NextResponse.json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting resource:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
