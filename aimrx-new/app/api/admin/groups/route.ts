/**
 * Admin Groups API
 *
 * Endpoint for admin users to manage provider groups
 * Only accessible to users with admin or super_admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse, getPharmacyAdminScope } from "@core/auth/api-guards";

export async function GET(request: NextRequest) {
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

    const supabase = createAdminClient();
    const isSuperAdmin = userRole === "super_admin";

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);

      if (scope.isPharmacyAdmin && !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }

      if (scope.isPharmacyAdmin && scope.pharmacyId) {
        const { data: dbGroups, error: dbError } = await supabase
          .from("groups")
          .select("*")
          .eq("pharmacy_id", scope.pharmacyId)
          .order("created_at", { ascending: false });

        if (dbError) {
          console.error("Error fetching groups:", dbError);
          return NextResponse.json(
            { error: "Failed to load groups. Please try again." },
            { status: 500 },
          );
        }

        const { data: pharmacyRow } = await supabase
          .from("pharmacies")
          .select("name")
          .eq("id", scope.pharmacyId)
          .single();

        const pmIds = [...new Set((dbGroups || []).map((g) => g.platform_manager_id).filter(Boolean))];
        let pmMap = new Map<string, string>();
        if (pmIds.length > 0) {
          const { data: pms } = await supabase.from("platform_managers").select("id, name").in("id", pmIds);
          pmMap = new Map((pms || []).map((pm) => [pm.id, pm.name]));
        }

        const enrichedGroups = (dbGroups || []).map((group) => ({
          ...group,
          platform_manager_name: group.platform_manager_id ? pmMap.get(group.platform_manager_id) || null : null,
          pharmacy_name: pharmacyRow?.name || null,
        }));

        return NextResponse.json({
          groups: enrichedGroups,
          total: enrichedGroups.length,
        });
      }
    }

    const filterPharmacyId = isSuperAdmin ? request.nextUrl.searchParams.get("pharmacyId") : null;

    let query = supabase.from("groups").select("*").order("created_at", { ascending: false });
    if (filterPharmacyId) {
      query = query.eq("pharmacy_id", filterPharmacyId);
    }

    const { data: dbGroups, error: dbError } = await query;

    if (dbError) {
      console.error("Error fetching groups:", dbError);
      return NextResponse.json(
        { error: "Failed to load groups. Please try again." },
        { status: 500 },
      );
    }

    const pmIds = [...new Set((dbGroups || []).map((g) => g.platform_manager_id).filter(Boolean))];
    let pmMap = new Map<string, string>();
    if (pmIds.length > 0) {
      const { data: pms } = await supabase.from("platform_managers").select("id, name").in("id", pmIds);
      pmMap = new Map((pms || []).map((pm) => [pm.id, pm.name]));
    }

    const pharmacyIds = [...new Set((dbGroups || []).map((g) => g.pharmacy_id).filter(Boolean))];
    let pharmacyNameMap = new Map<string, string>();
    if (pharmacyIds.length > 0) {
      const { data: pharmacyRows } = await supabase.from("pharmacies").select("id, name").in("id", pharmacyIds);
      pharmacyNameMap = new Map((pharmacyRows || []).map((p) => [p.id, p.name]));
    }

    const enrichedGroups = (dbGroups || []).map((group) => ({
      ...group,
      platform_manager_name: group.platform_manager_id ? pmMap.get(group.platform_manager_id) || null : null,
      pharmacy_name: group.pharmacy_id ? pharmacyNameMap.get(group.pharmacy_id) || null : null,
    }));

    return NextResponse.json({
      groups: enrichedGroups,
      total: enrichedGroups.length,
    });
  } catch (error) {
    console.error("Error listing groups:", error);
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
    const { name, platformManagerId, pharmacyId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      );
    }

    const isSuperAdmin = userRole === "super_admin";
    let resolvedPharmacyId: string | null = null;

    if (isSuperAdmin) {
      resolvedPharmacyId = pharmacyId || null;
    } else {
      const scope = await getPharmacyAdminScope(user.id);
      if (scope.isPharmacyAdmin && !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }
      if (scope.isPharmacyAdmin && scope.pharmacyId) {
        resolvedPharmacyId = scope.pharmacyId;
      } else {
        resolvedPharmacyId = pharmacyId || null;
      }
    }

    if (!resolvedPharmacyId) {
      return NextResponse.json(
        { error: "Missing required field: pharmacyId" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: dbGroup, error: dbError } = await supabase
      .from("groups")
      .insert({
        name,
        platform_manager_id: platformManagerId || null,
        pharmacy_id: resolvedPharmacyId,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error creating group:", dbError);
      return NextResponse.json(
        { error: "Failed to create group. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      group: dbGroup,
      message: "Group created successfully",
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
