import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { ensureEncrypted, decryptApiKey } from "@/core/security/encryption";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

/**
 * Update a pharmacy
 * PUT /api/admin/pharmacies/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "This action is restricted to platform administrators" },
        { status: 403 }
      );
    }

    const pharmacyId = params.id;

    // Parse request body
    const body = await request.json();
    const {
      name,
      slug,
      logo_url,
      primary_color,
      tagline,
      address,
      npi,
      dea_number,
      ncpdp_number,
      phone,
      system_type,
      api_url,
      api_key,
      shared_secret,
      store_id,
      location_id,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Update pharmacy basic info
    const { error: updateError } = await supabase
      .from("pharmacies")
      .update({
        name,
        slug: slug.toLowerCase().trim(),
        logo_url: logo_url || null,
        primary_color: primary_color || "#00AEEF",
        tagline: tagline || null,
        address: address || null,
        npi: npi || null,
        dea_number: dea_number || null,
        ncpdp_number: ncpdp_number || null,
        phone: phone || null,
      })
      .eq("id", pharmacyId);

    if (updateError) {
      console.error("Error updating pharmacy:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update pharmacy",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Update backend integration if provided
    if (system_type && store_id) {
      // Check if backend exists
      const { data: existingBackend } = await supabase
        .from("pharmacy_backends")
        .select("id")
        .eq("pharmacy_id", pharmacyId)
        .single();

      const backendData: Record<string, unknown> = {
        system_type,
        api_url: api_url || null,
        store_id,
        location_id: location_id || null,
      };

      if (api_key || (shared_secret && system_type === "PioneerRx")) {
        if (system_type === "PioneerRx" && existingBackend) {
          let existingApiKey = "";
          let existingSecret = "";
          const { data: backendRow } = await supabase
            .from("pharmacy_backends")
            .select("api_key_encrypted")
            .eq("id", existingBackend.id)
            .single();
          if (backendRow?.api_key_encrypted) {
            const decrypted = decryptApiKey(backendRow.api_key_encrypted);
            if (decrypted.includes("|")) {
              [existingApiKey, existingSecret] = decrypted.split("|", 2);
            } else {
              existingApiKey = decrypted;
            }
          }
          const finalApiKey = api_key || existingApiKey;
          const finalSecret = shared_secret || existingSecret;
          if (finalApiKey && finalSecret) {
            backendData.api_key_encrypted = ensureEncrypted(`${finalApiKey}|${finalSecret}`);
          } else if (finalApiKey) {
            backendData.api_key_encrypted = ensureEncrypted(finalApiKey);
          }
        } else if (api_key) {
          backendData.api_key_encrypted = ensureEncrypted(api_key);
        }
      }

      if (existingBackend) {
        // Update existing backend
        const { error: backendError } = await supabase
          .from("pharmacy_backends")
          .update(backendData)
          .eq("pharmacy_id", pharmacyId);

        if (backendError) {
          console.error("Error updating pharmacy backend:", backendError);
          return NextResponse.json(
            {
              success: false,
              error: "Failed to update pharmacy backend integration",
              details: backendError.message,
            },
            { status: 500 }
          );
        }
      } else {
        // Create new backend (requires API key)
        if (!api_key) {
          return NextResponse.json(
            {
              success: false,
              error: "API key is required to create backend integration",
            },
            { status: 400 }
          );
        }

        const { error: backendError } = await supabase
          .from("pharmacy_backends")
          .insert({
            pharmacy_id: pharmacyId,
            ...backendData,
            is_active: true,
          });

        if (backendError) {
          console.error("Error creating pharmacy backend:", backendError);
          return NextResponse.json(
            {
              success: false,
              error: "Failed to create pharmacy backend integration",
              details: backendError.message,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pharmacy "${name}" updated successfully`,
    });
  } catch (error) {
    console.error("Error in update pharmacy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update pharmacy",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Partial update a pharmacy (for pharmacy admins to update their own pharmacy settings)
 * PATCH /api/admin/pharmacies/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const pharmacyId = (await params).id;

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin && !scope.pharmacyId) {
      return NextResponse.json(
        { success: false, error: "Pharmacy admin scope could not be determined" },
        { status: 403 }
      );
    }
    if (scope.isPharmacyAdmin && scope.pharmacyId !== pharmacyId) {
      return NextResponse.json(
        { success: false, error: "You can only update your own pharmacy" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const allowedFields = ["phone", "address", "logo_url", "tagline"];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("pharmacies")
      .update(updateData)
      .eq("id", pharmacyId)
      .select("id");

    if (updateError) {
      console.error("Error updating pharmacy:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update pharmacy", details: updateError.message },
        { status: 500 }
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pharmacy not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Pharmacy updated successfully" });
  } catch (error) {
    console.error("Error in patch pharmacy:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update pharmacy", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Delete a pharmacy
 * DELETE /api/admin/pharmacies/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "This action is restricted to platform administrators" },
        { status: 403 }
      );
    }

    const pharmacyId = params.id;

    // Check if pharmacy exists
    const { data: pharmacy, error: fetchError } = await supabase
      .from("pharmacies")
      .select("name")
      .eq("id", pharmacyId)
      .single();

    if (fetchError || !pharmacy) {
      return NextResponse.json(
        { success: false, error: "Pharmacy not found" },
        { status: 404 }
      );
    }

    // Soft delete: set is_active = false instead of removing the row
    const { error: updateError } = await supabase
      .from("pharmacies")
      .update({ is_active: false })
      .eq("id", pharmacyId);

    if (updateError) {
      console.error("Error deactivating pharmacy:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to deactivate pharmacy",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Also deactivate the associated pharmacy_backend
    const { error: backendError } = await supabase
      .from("pharmacy_backends")
      .update({ is_active: false })
      .eq("pharmacy_id", pharmacyId);

    if (backendError) {
      console.error("Error deactivating pharmacy backend:", backendError);
    }

    return NextResponse.json({
      success: true,
      message: `Pharmacy "${pharmacy.name}" deactivated successfully`,
    });
  } catch (error) {
    console.error("Error deactivating pharmacy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to deactivate pharmacy",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
