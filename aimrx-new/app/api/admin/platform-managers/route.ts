import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";
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

    const isSuperAdmin = userRole === "super_admin";

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);
      if (scope.isPharmacyAdmin) {
        return NextResponse.json(
          { error: "This action is restricted to platform administrators" },
          { status: 403 },
        );
      }
    }

    const supabase = await createServerClient();

    const pharmacyIdFilter = isSuperAdmin
      ? request.nextUrl.searchParams.get("pharmacyId") || null
      : null;

    let pmIds: string[] | null = null;

    if (pharmacyIdFilter) {
      const { data: links } = await supabase
        .from("platform_manager_pharmacies")
        .select("platform_manager_id")
        .eq("pharmacy_id", pharmacyIdFilter);

      pmIds = links ? links.map((l) => l.platform_manager_id) : [];
    }

    let query = supabase
      .from("platform_managers")
      .select("*")
      .order("name", { ascending: true });

    if (pmIds !== null) {
      if (pmIds.length === 0) {
        return NextResponse.json({
          platformManagers: [],
          total: 0,
        });
      }
      query = query.in("id", pmIds);
    }

    const { data: platformManagers, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to load platform managers. Please try again." },
        { status: 500 },
      );
    }

    if (platformManagers && platformManagers.length > 0) {
      const ids = platformManagers.map((pm) => pm.id);
      const { data: allLinks } = await supabase
        .from("platform_manager_pharmacies")
        .select("platform_manager_id, pharmacy_id")
        .in("platform_manager_id", ids);

      if (allLinks && allLinks.length > 0) {
        const pharmacyIds = [...new Set(allLinks.map((l) => l.pharmacy_id))];
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id, name, slug")
          .in("id", pharmacyIds);

        const pharmacyMap = new Map(
          pharmacyData?.map((p) => [p.id, p]) || [],
        );

        const pmPharmacyMap = new Map<string, Array<{ id: string; name: string; slug: string }>>();
        for (const link of allLinks) {
          const pharmacy = pharmacyMap.get(link.pharmacy_id);
          if (pharmacy) {
            const existing = pmPharmacyMap.get(link.platform_manager_id) || [];
            existing.push(pharmacy);
            pmPharmacyMap.set(link.platform_manager_id, existing);
          }
        }

        for (const pm of platformManagers) {
          (pm as any).pharmacies = pmPharmacyMap.get(pm.id) || [];
        }
      } else {
        for (const pm of platformManagers) {
          (pm as any).pharmacies = [];
        }
      }
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

    const isSuperAdmin = userRole === "super_admin";

    if (!isSuperAdmin) {
      const postScope = await getPharmacyAdminScope(user.id);
      if (postScope.isPharmacyAdmin) {
        return NextResponse.json(
          { error: "This action is restricted to platform administrators" },
          { status: 403 },
        );
      }
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { name, email, pharmacy_ids } = body;

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

    if (pharmacy_ids && Array.isArray(pharmacy_ids) && pharmacy_ids.length > 0) {
      const links = pharmacy_ids.map((pharmacyId: string) => ({
        platform_manager_id: platformManager.id,
        pharmacy_id: pharmacyId,
      }));

      const { error: linkError } = await supabase
        .from("platform_manager_pharmacies")
        .insert(links);

      if (linkError) {
        console.error("Error linking pharmacies:", linkError);
        await supabase
          .from("platform_managers")
          .delete()
          .eq("id", platformManager.id);
        return NextResponse.json(
          { error: "Failed to associate pharmacies. Platform manager was not created." },
          { status: 500 },
        );
      }
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
