import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import { WESTSIDE_CATEGORIES } from "./categories-data";
import medicationsData from "./medications-data.json";

interface MedicationData {
  name: string;
  strength: string;
  form: string;
  ndc: string;
  vial_size: string;
  retail_price_cents: number;
  aimrx_site_pricing_cents: number;
  category: string;
  dosage_instructions: string;
  detailed_description: string;
  in_stock: boolean;
  preparation_time_days: number;
  notes: string;
}

const WESTSIDE_MEDICATIONS = medicationsData as MedicationData[];

async function requireSuperAdmin() {
  const { user, userRole } = await getUser();
  if (!user) return { authorized: false as const, error: "Not authenticated" };
  if (!userRole || userRole !== "super_admin") {
    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) return { authorized: false as const, error: "Super admin access required" };
    if (userRole !== "admin") return { authorized: false as const, error: "Admin access required" };
  }
  return { authorized: true as const, user };
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const supabaseAdmin = await createAdminClient();

  try {
    const url = new URL(request.url);
    const confirmKey = url.searchParams.get("confirm");
    if (confirmKey !== "westside2026") {
      return NextResponse.json(
        { error: "Confirmation required" },
        { status: 400 }
      );
    }

    const results = {
      pharmacy: null as string | null,
      categories: 0,
      medications: 0,
      skipped_categories: 0,
      skipped_medications: 0,
      errors: [] as string[],
    };

    const { data: existing } = await supabaseAdmin
      .from("pharmacies")
      .select("id")
      .eq("slug", "westside-compounding")
      .single();

    let pharmacyId: string;

    if (existing) {
      pharmacyId = existing.id;
      results.pharmacy = pharmacyId;
    } else {
      const { data: pharmacy, error: pharmErr } = await supabaseAdmin
        .from("pharmacies")
        .insert({
          name: "Westside Compounding",
          slug: "westside-compounding",
          primary_color: "#1D4E89",
          tagline: "Custom Compounding Solutions",
          is_active: true,
        })
        .select()
        .single();

      if (pharmErr || !pharmacy) {
        return NextResponse.json(
          { error: "Failed to create pharmacy", details: pharmErr?.message },
          { status: 500 }
        );
      }
      pharmacyId = pharmacy.id;
      results.pharmacy = pharmacyId;
    }

    for (const cat of WESTSIDE_CATEGORIES) {
      const { data: existingCat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("name", cat.name)
        .eq("pharmacy_id", pharmacyId)
        .single();

      if (existingCat) {
        results.skipped_categories++;
        continue;
      }

      const { data: slugCheck } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("slug", cat.slug)
        .single();

      const finalSlug = slugCheck ? `${cat.slug}-ws` : cat.slug;

      const { error: catErr } = await supabaseAdmin.from("categories").insert({
        name: slugCheck ? `${cat.name} (Westside)` : cat.name,
        slug: finalSlug,
        description: cat.desc,
        pharmacy_id: pharmacyId,
        display_order: cat.order,
        is_active: true,
        color: cat.color,
        image_url: `/catalog/westside/${cat.image}`,
      });

      if (catErr) {
        results.errors.push(`Category ${cat.name}: ${catErr.message}`);
      } else {
        results.categories++;
      }
    }

    for (const med of WESTSIDE_MEDICATIONS) {
      const { data: existingMed } = await supabaseAdmin
        .from("pharmacy_medications")
        .select("id")
        .eq("pharmacy_id", pharmacyId)
        .eq("name", med.name)
        .single();

      if (existingMed) {
        results.skipped_medications++;
        continue;
      }

      const { error: medErr } = await supabaseAdmin
        .from("pharmacy_medications")
        .insert({
          pharmacy_id: pharmacyId,
          name: med.name,
          strength: med.strength || null,
          form: med.form || null,
          ndc: med.ndc || null,
          vial_size: med.vial_size || null,
          retail_price_cents: med.retail_price_cents,
          aimrx_site_pricing_cents: med.aimrx_site_pricing_cents ?? null,
          category: med.category,
          dosage_instructions: med.dosage_instructions || null,
          detailed_description: med.detailed_description || null,
          in_stock: med.in_stock,
          preparation_time_days: Math.ceil(med.preparation_time_days) || 0,
          notes: med.notes || null,
          is_active: true,
        });

      if (medErr) {
        results.errors.push(
          `Med ${med.name.substring(0, 50)}: ${medErr.message}`
        );
      } else {
        results.medications++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Westside Compounding import complete",
      results,
    });
  } catch (error) {
    console.error("Westside import error:", error);
    return NextResponse.json(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  return NextResponse.json({
    info: "Westside Compounding bulk import endpoint",
    categories_count: WESTSIDE_CATEGORIES.length,
    medications_count: WESTSIDE_MEDICATIONS.length,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("confirm") !== "westside2026") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const supabaseAdmin = await createAdminClient();

  const { data: pharmacy } = await supabaseAdmin
    .from("pharmacies")
    .select("id")
    .eq("slug", "westside-compounding")
    .single();

  if (!pharmacy) {
    return NextResponse.json({ error: "Westside pharmacy not found" }, { status: 404 });
  }

  const { data: orphans } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("pharmacy_id", pharmacy.id)
    .like("name", "%(Westside)%");

  let deleted = 0;
  if (orphans) {
    for (const orphan of orphans) {
      await supabaseAdmin.from("categories").delete().eq("id", orphan.id);
      deleted++;
    }
  }

  return NextResponse.json({ success: true, deleted });
}
