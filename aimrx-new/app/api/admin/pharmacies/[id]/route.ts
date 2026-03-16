import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { ensureEncrypted } from "@/core/security/encryption";

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
    // Get current user
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

      // Only update API key if provided (not empty)
      if (api_key) {
        backendData.api_key_encrypted = ensureEncrypted(api_key);
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
 * Delete a pharmacy
 * DELETE /api/admin/pharmacies/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();

  try {
    // Get current user
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
