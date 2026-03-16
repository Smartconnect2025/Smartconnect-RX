/**
 * Admin Users API
 *
 * Endpoint for admin users to create new admin and provider accounts
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { createUserAccount } from "@core/services/account-management";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

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
    const { email, password, role, firstName, lastName, phone, tierLevel, groupId } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, role" },
        { status: 400 },
      );
    }

    // Validate role
    if (!["admin", "provider"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'provider'" },
        { status: 400 },
      );
    }

    // Create the user account
    const result = await createUserAccount({
      email,
      password,
      role,
      firstName,
      lastName,
      phone,
      tierLevel,
      groupId,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      message: `Successfully created ${role} account`,
    });
  } catch (error) {
    console.error("Error creating user account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
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

    // Get all users with their roles and profiles
    const supabase = createAdminClient();

    // Get all auth users
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      return NextResponse.json(
        { error: "Failed to fetch user roles" },
        { status: 500 },
      );
    }

    // Get provider profiles
    const { data: providerProfiles, error: providerError } = await supabase
      .from("providers")
      .select("*");

    if (providerError) {
      console.error("Error fetching provider profiles:", providerError);
      return NextResponse.json(
        { error: "Failed to fetch provider profiles" },
        { status: 500 },
      );
    }

    // Combine the data
    const users = authUsers.users.map((authUser) => {
      const userRole = userRoles?.find((ur) => ur.user_id === authUser.id);
      const providerProfile = providerProfiles?.find(
        (pp) => pp.user_id === authUser.id,
      );

      return {
        id: authUser.id,
        email: authUser.email,
        role: userRole?.role || "user",
        firstName: providerProfile?.first_name || null,
        lastName: providerProfile?.last_name || null,
        phone: providerProfile?.phone_number || null,
        createdAt: authUser.created_at,
        lastSignIn: authUser.last_sign_in_at,
        status: authUser.confirmed_at ? "active" : "inactive",
      };
    });

    return NextResponse.json({
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
