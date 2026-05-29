/**
 * Admin Platform Managers API
 *
 * Endpoint for admin users to manage platform managers
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

export async function GET() {
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

    const supabase = await createServerClient();

    const { data: platformManagers, error } = await supabase
      .from("platform_managers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load platform managers. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      platformManagers: platformManagers || [],
      total: platformManagers?.length || 0,
    });
  } catch (error) {
    console.error("Error listing platform managers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { name, email } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    const { data: platformManager, error } = await supabase
      .from("platform_managers")
      .insert({ name, email: email || null })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create platform manager. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      platformManager,
      message: "Platform manager created successfully",
    });
  } catch (error) {
    console.error("Error creating platform manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
