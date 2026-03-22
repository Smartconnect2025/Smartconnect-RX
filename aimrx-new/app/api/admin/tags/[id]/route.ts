import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    const isSuperAdmin = userRole === "super_admin";

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Tag name must be 50 characters or less" },
        { status: 400 },
      );
    }

    const supabase = createClient();

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      const { data: tag } = await supabase
        .from("tags")
        .select("pharmacy_id")
        .eq("id", id)
        .single();
      if (!tag) {
        return NextResponse.json({ error: "Tag not found" }, { status: 404 });
      }
      if (tag.pharmacy_id !== scope.pharmacyId) {
        return NextResponse.json({ error: "Tag not found" }, { status: 404 });
      }
    }

    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("id, name, pharmacy_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    let duplicateQuery = supabase
      .from("tags")
      .select("id")
      .eq("name", trimmedName)
      .neq("id", id);

    if (existingTag.pharmacy_id) {
      duplicateQuery = duplicateQuery.eq("pharmacy_id", existingTag.pharmacy_id);
    }

    const { data: duplicateTag } = await duplicateQuery.single();

    if (duplicateTag) {
      return NextResponse.json(
        { error: "A tag with this name already exists for this pharmacy" },
        { status: 400 },
      );
    }

    const slug = generateSlug(trimmedName);

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

    const isSuperAdmin = userRole === "super_admin";

    const { id } = await params;
    const supabase = createClient();

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      const { data: tag } = await supabase
        .from("tags")
        .select("pharmacy_id")
        .eq("id", id)
        .single();
      if (!tag) {
        return NextResponse.json({ error: "Tag not found" }, { status: 404 });
      }
      if (tag.pharmacy_id !== scope.pharmacyId) {
        return NextResponse.json({ error: "Tag not found" }, { status: 404 });
      }
    }

    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("id, name, usage_count, pharmacy_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    let resourcesQuery = supabase
      .from("resources")
      .select("id, tags")
      .contains("tags", [existingTag.name]);

    if (existingTag.pharmacy_id) {
      resourcesQuery = resourcesQuery.eq("pharmacy_id", existingTag.pharmacy_id);
    }

    const { data: resourcesWithTag, error: fetchResourcesError } =
      await resourcesQuery;

    if (fetchResourcesError) {
      console.error("Error fetching resources with tag:", fetchResourcesError);
      return NextResponse.json(
        { error: "Failed to fetch resources with tag" },
        { status: 500 },
      );
    }

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
