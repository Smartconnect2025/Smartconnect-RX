/**
 * Admin Resources API
 *
 * Endpoint for admin users to manage educational resources
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { updateTagUsageCounts } from "@/features/admin-dashboard/utils/tagUsageUpdater";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const tags = searchParams.get("tags") || "";
    const offset = (page - 1) * limit;

    const supabase = createClient();

    // Build the query
    let query = supabase
      .from("resources")
      .select("*", { count: "exact", head: true });

    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (type) {
      query = query.eq("type", type);
    }
    if (tags) {
      const tagArray = tags.split(",").filter((t) => t.trim());
      if (tagArray.length > 0) {
        query = query.overlaps("tags", tagArray);
      }
    }

    // Get total count with filters
    const { count } = await query;

    // Get paginated resources with filters
    let resourcesQuery = supabase.from("resources").select("*");

    // Apply same filters
    if (search) {
      resourcesQuery = resourcesQuery.or(
        `title.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }
    if (type) {
      resourcesQuery = resourcesQuery.eq("type", type);
    }
    if (tags) {
      const tagArray = tags.split(",").filter((t) => t.trim());
      if (tagArray.length > 0) {
        resourcesQuery = resourcesQuery.overlaps("tags", tagArray);
      }
    }

    const { data: resources, error } = await resourcesQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching resources:", error);
      return NextResponse.json(
        { error: "Failed to fetch resources" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      resources: resources || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in resources GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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
    // - Video and Link require URL
    // - Text Content requires content
    // - PDF and Article: URL optional
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

    // Create the resource
    const { data, error } = await supabase
      .from("resources")
      .insert({
        title,
        description,
        url: url || null,
        content: content || null,
        type,
        tags: tags || [],
        cover_src: cover_src || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating resource:", error);
      return NextResponse.json(
        { error: "Failed to create resource" },
        { status: 500 },
      );
    }

    // Update tag usage counts after creating resource
    await updateTagUsageCounts();

    return NextResponse.json({
      success: true,
      resource: data,
      message: "Resource created successfully",
    });
  } catch (error) {
    console.error("Error creating resource:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
