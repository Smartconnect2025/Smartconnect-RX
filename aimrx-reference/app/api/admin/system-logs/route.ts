import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";

/**
 * Get system logs with filtering
 * GET /api/admin/system-logs?action=&status=&limit=&offset=
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();

  try {
    // Check if user is platform owner
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

    // Check if user has admin role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("system_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (action) {
      query = query.eq("action", action);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("Error fetching system logs:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch system logs" },
        { status: 500 }
      );
    }

    // Get distinct actions and statuses for filters
    const { data: actions } = await supabase
      .from("system_logs")
      .select("action")
      .order("action");

    const { data: statuses } = await supabase
      .from("system_logs")
      .select("status")
      .order("status");

    const uniqueActions = [...new Set(actions?.map((a) => a.action) || [])];
    const uniqueStatuses = [...new Set(statuses?.map((s) => s.status) || [])];

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total: count || 0,
      limit,
      offset,
      filters: {
        actions: uniqueActions,
        statuses: uniqueStatuses,
      },
    });
  } catch (error) {
    console.error("Error in system logs API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch system logs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Create a system log entry
 * POST /api/admin/system-logs
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();

  try {
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

    const body = await request.json();
    const { action, details, status = "success", user_email, user_name } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      );
    }

    const { data: log, error } = await supabase
      .from("system_logs")
      .insert({
        user_email: user_email || user.email || "system",
        user_name: user_name || "System",
        action,
        details: details || null,
        status,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating system log:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create system log" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error("Error in create system log:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create system log",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
