import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { requireNonDemo, createGuardErrorResponse, getPharmacyAdminScope } from "@core/auth/api-guards";
import { getUser } from "@core/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();

  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin access required" },
        { status: 403 }
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const scope = await getPharmacyAdminScope(user.id);
    const medicationId = id;

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json(
          { success: false, error: "Pharmacy admin has no linked pharmacy" },
          { status: 403 }
        );
      }

      const { data: existingMed } = await supabase
        .from("pharmacy_medications")
        .select("id")
        .eq("id", medicationId)
        .eq("pharmacy_id", scope.pharmacyId)
        .single();

      if (!existingMed) {
        return NextResponse.json(
          { success: false, error: "Medication not found or unauthorized" },
          { status: 404 }
        );
      }
    } else {
      const { data: existingMed } = await supabase
        .from("pharmacy_medications")
        .select("id")
        .eq("id", medicationId)
        .single();

      if (!existingMed) {
        return NextResponse.json(
          { success: false, error: "Medication not found" },
          { status: 404 }
        );
      }
    }

    const body = await request.json();
    const {
      name,
      strength,
      vial_size,
      form,
      ndc,
      retail_price_cents,
      aimrx_site_pricing_cents,
      category,
      dosage_instructions,
      detailed_description,
      image_url,
      is_active,
      in_stock,
      preparation_time_days,
      notes,
    } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (strength !== undefined || vial_size !== undefined) {
      updateData.strength = strength || vial_size || null;
    }
    if (form !== undefined) updateData.form = form;
    if (ndc !== undefined) updateData.ndc = ndc;
    if (retail_price_cents !== undefined) {
      updateData.retail_price_cents = parseInt(retail_price_cents);
    }
    if (category !== undefined) updateData.category = category;
    if (dosage_instructions !== undefined) updateData.dosage_instructions = dosage_instructions;
    if (detailed_description !== undefined) updateData.detailed_description = detailed_description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (in_stock !== undefined) updateData.in_stock = in_stock;
    if (preparation_time_days !== undefined) {
      updateData.preparation_time_days = preparation_time_days ? parseInt(preparation_time_days) : 0;
    }
    if (aimrx_site_pricing_cents !== undefined) {
      updateData.aimrx_site_pricing_cents = parseInt(aimrx_site_pricing_cents);
    }
    if (notes !== undefined) updateData.notes = notes;

    let medication, updateError;
    if (scope.isPharmacyAdmin) {
      const result = await supabase
        .from("pharmacy_medications")
        .update(updateData)
        .eq("id", medicationId)
        .eq("pharmacy_id", scope.pharmacyId!)
        .select()
        .single();
      medication = result.data;
      updateError = result.error;
    } else {
      const result = await supabase
        .from("pharmacy_medications")
        .update(updateData)
        .eq("id", medicationId)
        .select()
        .single();
      medication = result.data;
      updateError = result.error;
    }

    if (updateError) {
      console.error("Error updating medication:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update medication",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Medication updated successfully",
      medication,
    });
  } catch (error) {
    console.error("Error in update medication:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update medication",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();

  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin access required" },
        { status: 403 }
      );
    }

    const demoCheck2 = await requireNonDemo();
    if (!demoCheck2.success) return createGuardErrorResponse(demoCheck2);

    const scope = await getPharmacyAdminScope(user.id);
    const medicationId = id;

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json(
          { success: false, error: "Pharmacy admin has no linked pharmacy" },
          { status: 403 }
        );
      }
    }

    let deleteError;
    if (scope.isPharmacyAdmin) {
      const result = await supabase
        .from("pharmacy_medications")
        .delete()
        .eq("id", medicationId)
        .eq("pharmacy_id", scope.pharmacyId!);
      deleteError = result.error;
    } else {
      const result = await supabase
        .from("pharmacy_medications")
        .delete()
        .eq("id", medicationId);
      deleteError = result.error;
    }

    if (deleteError) {
      console.error("Error deleting medication:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete medication",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Medication deleted successfully",
    });
  } catch (error) {
    console.error("Error in delete medication:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete medication",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
