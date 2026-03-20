/**
 * Admin Tags API
 *
 * Endpoint for admin users to manage resource tags
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { requireNonDemo, requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}

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
    const offset = (page - 1) * limit;

    const supabase = createClient();

    // Build the query
    let query = supabase
      .from("tags")
      .select("*", { count: "exact", head: true });

    // Apply search filter
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Get total count with filters
    const { count } = await query;

    // Get paginated tags with filters
    let tagsQuery = supabase.from("tags").select("*");

    // Apply same filters
    if (search) {
      tagsQuery = tagsQuery.ilike("name", `%${search}%`);
    }

    const { data: tags, error } = await tagsQuery
      .order("usage_count", { ascending: false }) // Sort by usage count descending
      .order("name", { ascending: true }) // Then by name ascending
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching tags:", error);
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tags: tags || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in tags GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const platformCheck = await requirePlatformAdmin();
    if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

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

    // Check if tag name already exists
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("name", trimmedName)
      .single();

    if (existingTag) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 },
      );
    }

    // Generate slug
    const slug = generateSlug(trimmedName);

    // Create the tag
    const { data, error } = await supabase
      .from("tags")
      .insert({
        name: trimmedName,
        slug,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      return NextResponse.json(
        { error: "Failed to create tag" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      tag: data,
      message: "Tag created successfully",
    });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
