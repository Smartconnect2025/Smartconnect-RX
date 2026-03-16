import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

// GET - Fetch all medications or search
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: adminLink } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let query = supabase
      .from("pharmacy_medications")
      .select("*")
      .order("name", { ascending: true });

    if (adminLink?.pharmacy_id) {
      query = query.eq("pharmacy_id", adminLink.pharmacy_id);
    }

    // If search term is provided, filter results
    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      query = query.ilike("name", searchTerm);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching medication catalog:", error);
      return NextResponse.json(
        { error: "Failed to fetch medications" },
        { status: 500 }
      );
    }

    // Transform pharmacy_medications format to match frontend expectations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedData = (data || []).map((med: any) => ({
      id: med.id,
      medication_name: med.name,
      vial_size: med.strength,
      dosage_amount: med.strength ? med.strength.match(/[\d.]+/)?.[0] : null,
      dosage_unit: med.strength ? med.strength.match(/[a-zA-Z]+/)?.[0] : null,
      form: med.form,
      quantity: "1",
      refills: "0",
      sig: null,
      pharmacy_notes: null,
      retail_price_cents: med.retail_price_cents,
      aimrx_site_pricing_cents: med.aimrx_site_pricing_cents || (med.notes ? parseInt(med.notes) : med.retail_price_cents),
    }));

    return NextResponse.json({ medications: transformedData });
  } catch (error) {
    console.error("Error in GET /api/medication-catalog:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new medication
export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const supabase = createAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("medication_catalog")
      .insert({
        medication_name: body.medication_name,
        vial_size: body.vial_size || null,
        dosage_amount: body.dosage_amount || null,
        dosage_unit: body.dosage_unit || null,
        form: body.form || null,
        quantity: body.quantity || null,
        refills: body.refills || null,
        sig: body.sig || null,
        pharmacy_notes: body.pharmacy_notes || null,
        patient_price: body.patient_price || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating medication:", error);
      return NextResponse.json(
        { error: "Failed to create medication" },
        { status: 500 }
      );
    }

    return NextResponse.json({ medication: data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/medication-catalog:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
