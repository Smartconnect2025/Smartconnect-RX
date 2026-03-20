import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { DEFAULT_PHARMACY_SLUG } from "@core/constants";
import { requireNonDemo, createGuardErrorResponse, getPharmacyAdminScope } from "@core/auth/api-guards";
import { getUser } from "@core/auth";

export async function POST(request: Request) {
  const supabase = await createServerClient();

  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin access required" },
        { status: 403 },
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const scope = await getPharmacyAdminScope(user.id);

    let pharmacyId: string;

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json(
          { success: false, error: "Pharmacy admin has no linked pharmacy" },
          { status: 403 },
        );
      }
      pharmacyId = scope.pharmacyId;
    } else {
      if (body.pharmacy_id) {
        pharmacyId = body.pharmacy_id;
      } else {
        const { data: defaultPharmacy } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("slug", DEFAULT_PHARMACY_SLUG)
          .single();

        if (!defaultPharmacy) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Default pharmacy not found. Please specify a pharmacy_id.",
            },
            { status: 400 },
          );
        }

        pharmacyId = defaultPharmacy.id;
      }
    }
    const {
      name,
      strength,
      vial_size,
      form,
      ndc,
      retail_price_cents,

      category,
      dosage_instructions,
      detailed_description,
      image_url,
      in_stock,
      preparation_time_days,
      notes,
    } = body;

    if (!name || !retail_price_cents) {
      return NextResponse.json(
        {
          success: false,
          error: "Medication name and retail price are required",
        },
        { status: 400 },
      );
    }

    const { data: medication, error: insertError } = await supabase
      .from("pharmacy_medications")
      .insert({
        pharmacy_id: pharmacyId,
        name,
        strength: strength || vial_size || null,
        form: form || null,
        ndc: ndc || null,
        retail_price_cents: parseInt(retail_price_cents),
        category: category || null,
        dosage_instructions: dosage_instructions || null,
        detailed_description: detailed_description || null,
        image_url: image_url || null,
        is_active: true,
        in_stock: in_stock !== undefined ? in_stock : true,
        preparation_time_days: preparation_time_days
          ? parseInt(preparation_time_days)
          : 0,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating medication:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create medication",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Medication "${name}" created successfully`,
      medication,
    });
  } catch (error) {
    console.error("Error in create medication:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create medication",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const supabase = await createServerClient();

  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin access required" },
        { status: 403 },
      );
    }

    const scope = await getPharmacyAdminScope(user.id);

    let medications;
    let error;

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json(
          { success: false, error: "Pharmacy admin has no linked pharmacy" },
          { status: 403 },
        );
      }

      const result = await supabase
        .from("pharmacy_medications")
        .select("*")
        .eq("pharmacy_id", scope.pharmacyId)
        .order("created_at", { ascending: false });

      medications = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("pharmacy_medications")
        .select("*")
        .order("created_at", { ascending: false });

      medications = result.data;
      error = result.error;
    }

    if (medications && medications.length > 0) {
      const pharmacyIds = [...new Set(medications.map((m) => m.pharmacy_id))];
      const { data: pharmacyData } = await supabase
        .from("pharmacies")
        .select("id, name")
        .in("id", pharmacyIds);

      const pharmacyMap = new Map(pharmacyData?.map((p) => [p.id, p]) || []);
      medications = medications.map((med) => ({
        ...med,
        pharmacies: pharmacyMap.get(med.pharmacy_id),
      }));
    }

    if (error) {
      console.error("Error fetching medications:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch medications" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      medications,
    });
  } catch (error) {
    console.error("Error in get medications:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch medications",
      },
      { status: 500 },
    );
  }
}
