/**
 * Admin Tags API - Individual Tag Operations
 *
 * Endpoint for admin users to update and delete specific tags
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check if the current user is an admin
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    // Validate name length
    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Tag name must be 50 characters or less" },
        { status: 400 },
      );
    }

    const supabase = createClient();

    // Check if tag exists
    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("id, name")
      .eq("id", id)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check if another tag with this name already exists (excluding current tag)
    const { data: duplicateTag } = await supabase
      .from("tags")
      .select("id")
      .eq("name", trimmedName)
      .neq("id", id)
      .single();

    if (duplicateTag) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 },
      );
    }

    // Generate new slug
    const slug = generateSlug(trimmedName);

    // Update the tag
    const { data, error } = await supabase
      .from("tags")
      .update({
        name: trimmedName,
        slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating tag:", error);
      return NextResponse.json(
        { error: "Failed to update tag" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      tag: data,
      message: "Tag updated successfully",
    });
  } catch (error) {
    console.error("Error updating tag:", error);
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
    // Check if the current user is an admin
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const supabase = createClient();

    // Check if tag exists
    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("id, name, usage_count")
      .eq("id", id)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Remove the tag from all resources that use it (automatic cleanup)
    // First, get all resources that use this tag
    const { data: resourcesWithTag, error: fetchResourcesError } =
      await supabase
        .from("resources")
        .select("id, tags")
        .contains("tags", [existingTag.name]);

    if (fetchResourcesError) {
      console.error("Error fetching resources with tag:", fetchResourcesError);
      return NextResponse.json(
        { error: "Failed to fetch resources with tag" },
        { status: 500 },
      );
    }

    // Update each resource to remove the tag
    let resourcesUpdated = 0;
    if (resourcesWithTag && resourcesWithTag.length > 0) {
      for (const resource of resourcesWithTag) {
        const updatedTags = resource.tags.filter(
          (tag: string) => tag !== existingTag.name,
        );
        const { error: updateError } = await supabase
          .from("resources")
          .update({ tags: updatedTags })
          .eq("id", resource.id);

        if (updateError) {
          console.error("Error removing tag from resource:", updateError);
          return NextResponse.json(
            { error: "Failed to remove tag from resources" },
            { status: 500 },
          );
        }
        resourcesUpdated++;
      }
    }

    // Delete the tag
    const { error } = await supabase.from("tags").delete().eq("id", id);

    if (error) {
      console.error("Error deleting tag:", error);
      return NextResponse.json(
        { error: "Failed to delete tag" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tag deleted successfully",
      resourcesUpdated,
    });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
