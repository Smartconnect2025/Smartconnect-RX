/**
 * Admin Provider Update API
 *
 * Endpoint for admin users to update provider data
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

export async function PATCH(
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const body = await request.json();

    const supabase = createAdminClient();

    let oldCompanyName: string | null | undefined = undefined;
    if ("company_name" in body) {
      const { data: oldProvider, error: lookupError } = await supabase
        .from("providers")
        .select("company_name")
        .eq("id", id)
        .single();
      if (lookupError) {
        console.error("Error looking up provider for company change:", lookupError);
        return NextResponse.json(
          { error: "Failed to look up provider" },
          { status: 500 },
        );
      }
      oldCompanyName = oldProvider?.company_name || null;
    }

    const { error } = await supabase
      .from("providers")
      .update(body)
      .eq("id", id);

    if (error) {
      console.error("Error updating provider:", error);
      return NextResponse.json(
        { error: "Failed to update provider" },
        { status: 500 },
      );
    }

    const newCompanyName = (body.company_name || "").trim().toLowerCase();
    const oldCompanyNorm = (oldCompanyName || "").trim().toLowerCase();

    if ("company_name" in body && oldCompanyNorm !== newCompanyName) {
      try {
        if (oldCompanyName) {
          const { error: removeError } = await supabase.rpc("remove_non_owned_patient_mappings", {
            p_provider_id: id,
          });
          if (removeError) {
            console.error("Remove old company mappings RPC error:", removeError.message, { providerId: id, oldCompanyName });
          }
        }

        if (body.company_name) {
          const { error: syncError } = await supabase.rpc("sync_provider_to_group_patients", {
            p_provider_id: id,
          });
          if (syncError) {
            console.error("Sync new company patients RPC error:", syncError.message, { providerId: id, newCompanyName: body.company_name });
          }
        }
      } catch (syncError) {
        console.error("Company reassignment sync error (non-fatal):", syncError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating provider:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
