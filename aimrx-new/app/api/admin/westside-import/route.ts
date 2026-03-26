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

const MEDICATION_IMAGE_MAP: Record<string, string> = {
  "LIPO-B Injection": "lipo-b-injection.png",
  "Semaglutide + B12 Injection": "semaglutide-b12-injection.png",
  "BPC-157 Capsules": "bpc-157-capsules.png",
  "NAD+ IV Therapy": "nad-iv-therapy.png",
  "ABH TOPICAL": "abh-topical.png",
  "ABHR TOPICAL": "abhr-topical.png",
  "Acyclovir 5% Hydrocortisone 1%": "acyclovir-hydrocortisone.png",
  "Alpha Lipoic Acid": "ala-estriol-cream.png",
  "Amiodaraone 20mg": "amiodarone-suspension.png",
  "Amitrip.HCl/Baclo/Gaba/Lido": "amitriptyline-vaginal.png",
  "Amitrip.HCl/Clon.HCl/Gaba/Keta/Keto/Lido": "amitriptyline-pain-cream.png",
  "Amitrip.HCl/Diclo/DMSO/Gaba/Ketam/Lido": "amitriptyline-dmso-cream.png",
  "APNO - Mupirocin": "apno-nipple-ointment.png",
  "Baclofen 10mg/mL Oral": "baclofen-suspension.png",
  "Baclofen/Ketamine HCl/Lidocaine": "baclofen-ketamine-topical.png",
  "Benzocaine 5%/Ibuprofen 2% Otic": "benzocaine-ibuprofen-otic.png",
  "Benzocaine/Lidocaine/Tetracaine": "blt-anesthetic.png",
  "Bi-Est (50:50) 0.5mg/mL Topical Cream": "bi-est-cream.png",
  "Bi-Est (50:50) 0.5mg/Progesterone 25mg": "bi-est-progesterone-cream.png",
  "Bi-Est (50:50) 0.5mg/Progesterone 25mg/Testosterone": "bi-est-prog-test-cream.png",
  "Bi-Est (50:50) 2mg/Testosterone 2mg TROCHE": "bi-est-testosterone-troche.png",
  "Budesonide 1mg Cap": "budesonide-nasal-capsule.png",
  "Budesonide 1mg/2mL Poloxamer": "budesonide-suspension.png",
  "Bupropion HCl/Naltrexone HCl (50mg/5mg)": "bupropion-naltrexone.png",
  "Bupropion/Naltrexone/Topiramate": "bupropion-naltrexone-topiramate.png",
  "Caffeine/Dutasteride": "trichofoam-hair.png",
  "Cimetidine 2%/Fluorouracil": "cimetidine-fluorouracil-topical.png",
  "DHEA 10mg SR": "dhea-capsule.png",
  "DHEA 6.5mg Suppository": "dhea-suppository.png",
  "Diazepam 10mg Suppositories": "diazepam-suppository-10.png",
  "Diazepam 2.5mg Suppositories": "diazepam-suppository-2.5.png",
  "Diltiazem HCl 2%": "diltiazem-rectal.png",
  "Dr Smith": "dr-smiths-nose-drops.png",
  "Enclomiphene Citrate": "enclomiphene-capsule.png",
  "Estradiol 0.01%/Estriol": "estradiol-estriol-cream.png",
  "FLuoxetine HCl": "fluoxetine-suspension.png",
  "Gabapentin 50mg/mL": "gabapentin-suspension.png",
  "Gabapentin/Ketamine HCl/Ketoprofen/Lidocaine": "gabapentin-ketamine-gel.png",
  "Gold Dust": "gold-dust-otic.png",
  "Hydrocone": "hydrocodone-suspension.png",
  "Hydroquinone 4%": "hydroquinone-tretinoin-cream.png",
  "Ketamine 100mg Troche": "ketamine-troche.png",
  "Ketamine 100mg/mL Nasal": "ketamine-nasal-spray.png",
  "Ketamine/Lidocaine": "ketamine-lidocaine-cream.png",
  "Lactulose": "lactulose-solution.png",
  "Low Dose Naltrexone 1.5mg": "ldn-1.5mg.png",
  "Low Dose Naltrexone 3mg": "ldn-3mg.png",
  "Low Dose Naltrexone 4.5mg": "ldn-4.5mg.png",
  "Levothyroxine": "levothyroxine-suspension.png",
  "Lidocaine/Menthol/Methyl": "lidocaine-menthol-cream.png",
  "Lidocaine/Prilocaine": "lidocaine-prilocaine.png",
  "Metoclopramide": "metoclopramide-topiclick.png",
  "Methimazole": "methimazole-suspension.png",
  "Methylene Blue": "methylene-blue-capsule.png",
  "Methylcobalamin/Gabapentin": "methylcobalamin-gabapentin-roller.png",
  "Metronidazole": "metronidazole-suppository.png",
  "Mupirocin 2%": "mupirocin-ointment.png",
  "NAD+ 100mg Troche": "nad-troche.png",
  "Nifedipine": "nifedipine-rectal.png",
  "Ondansetron 8mg/0.1mL Nasal": "ondansetron-nasal.png",
  "Ondansetron ODT": "ondansetron-odt.png",
  "Oxytocin 10 IU/0.1mL Nasal": "oxytocin-nasal-spray.png",
  "Oxytocin 10 IU Troche": "oxytocin-troche-10.png",
  "Oxytocin 25 IU Troche": "oxytocin-troche-25.png",
  "Oxytocin 50 IU Troche": "oxytocin-troche-50.png",
  "Phenazopyridine": "phenazopyridine-capsule.png",
  "Phentermine/Topiramate": "phentermine-topiramate.png",
  "Pimobendan": "pimobendan-suspension.png",
  "Piroxicam": "piroxicam-suspension.png",
  "Potassium Br 500mg/mL": "potassium-bromide-liquid.png",
  "Potassium Br 750mg": "potassium-bromide-750-cap.png",
  "Potassium Br 500mg Capsule": "potassium-bromide-500-cap.png",
  "Progesterone 0.5% Shampoo": "progesterone-shampoo.png",
  "Progesterone 100mg SR": "progesterone-100-sr.png",
  "Progesterone 150mg SR": "progesterone-150-sr.png",
  "Progesterone 150mg IR": "progesterone-150-ir.png",
  "Progesterone 200mg SR": "progesterone-200-sr.png",
  "Progesterone 40mg/mL": "progesterone-40-cream.png",
  "Progesterone 50mg SR": "progesterone-50-sr.png",
  "Progesterone 60mg/mL Topical Cream": "progesterone-60-cream.png",
  "Progesterone 60mg/Testosterone": "progesterone-testosterone-cream.png",
  "Progesterone 80mg/mL": "progesterone-80-cream.png",
  "Promethazine HCl": "promethazine-topiclick.png",
  "Rectal Rocket-Hydrocortisone/Lidocaine (2%/4%)": "rectal-rocket-hydro-lido.png",
  "Rectal Rocket-Hydrocortisone/Lidocaine/Ketoprofen": "rectal-rocket-triple.png",
  "Semaglutide 3.05mg": "semaglutide-sublingual-3.png",
  "Semaglutide 6.1mg": "semaglutide-sublingual-6.png",
  "Sildenafil 100mg Troche": "sildenafil-troche.png",
  "Sildenafil/Tadalafil/Apomorphine": "sildenafil-tadalafil-combo.png",
  "Tadalafil 20mg Troche": "tadalafil-troche.png",
  "Tadalafil 5mg/Arginine": "tadalafil-arginine-capsule.png",
  "Testosterone 2mg Troche": "testosterone-troche.png",
  "Testosterone 100mg/gm (10%)": "testosterone-10-gel.png",
  "Testosterone 200mg/gm (20%)": "testosterone-20-gel.png",
  "Testosterone 1mg/mL": "testosterone-1-cream.png",
  "Testosterone 5mg/0.5mL": "testosterone-5-cream.png",
  "Tri-Est 1mg": "tri-est-cream.png",
  "Zinc Pyr": "zinc-clobetasol-spray.png",
  "METHYLCOBALAMIN 10mg": "methylcobalamin-injection.png",
  "Semaglutide 2.5mg/Niacinamide": "semaglutide-niacinamide-2.5.png",
  "Semaglutide 5mg/Niacinamide": "semaglutide-niacinamide-5.png",
  "Tirzepatide 10mg": "tirzepatide-niacinamide-10.png",
  "Tirzepatide 20mg": "tirzepatide-niacinamide-20.png",
  "Tri-Mix 2mL REGULAR": "trimix-2ml-regular.png",
  "Tri-Mix 5mL REGULAR": "trimix-5ml-regular.png",
  "Tri-Mix 2mL DOUBLE": "trimix-2ml-double.png",
  "Tri-Mix 5mL DOUBLE": "trimix-5ml-double.png",
  "Tri-Mix 2mL SUPER": "trimix-2ml-super.png",
  "Tri-Mix 5mL SUPER": "trimix-5ml-super.png",
  "Ketamine 25mg/Midazolam": "ketamine-midazolam-troche.png",
  "Ketamine HCl 100mg Capsule": "ketamine-capsule.png",
  "Lanolin/Mupirocin": "lanolin-mupirocin-nystatin.png",
  "MW+AlMgSim/Diphen/LIdo(AA)": "magic-mouthwash.png",
  "MW+AlMgSim/Diphen/LIdo/Nyst": "magic-mouthwash-nystatin.png",
  "Naltrexone HCl 0.5mg": "naltrexone-0.5mg.png",
  "Naltrexone HCl 1.5mg": "naltrexone-1.5mg.png",
  "Naltrexone HCl 3mg": "naltrexone-3mg.png",
  "Naltrexone HCl 4.5mg": "naltrexone-4.5mg.png",
  "Oxytocin 100u": "oxytocin-nasal-100.png",
};

function findImageForMedication(medName: string): string | null {
  for (const [key, filename] of Object.entries(MEDICATION_IMAGE_MAP)) {
    if (medName.startsWith(key)) return filename;
  }
  return null;
}

export async function PATCH() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const supabaseAdmin = await createAdminClient();
  const pharmacyId = "5bcaf49a-d5d2-4506-8675-43d9eea249ac";

  const { data: meds, error: fetchErr } = await supabaseAdmin
    .from("pharmacy_medications")
    .select("id, name")
    .eq("pharmacy_id", pharmacyId);

  if (fetchErr || !meds) {
    return NextResponse.json({ error: fetchErr?.message || "No meds found" }, { status: 500 });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const med of meds) {
    const imageFile = findImageForMedication(med.name);
    if (!imageFile) {
      skipped++;
      continue;
    }

    const imageUrl = `/catalog/westside/medications/${imageFile}`;
    const { error: updErr } = await supabaseAdmin
      .from("pharmacy_medications")
      .update({ image_url: imageUrl })
      .eq("id", med.id);

    if (updErr) {
      errors.push(`${med.name.substring(0, 40)}: ${updErr.message}`);
    } else {
      updated++;
    }
  }

  return NextResponse.json({
    success: true,
    message: "Medication images updated",
    updated,
    skipped,
    total: meds.length,
    errors: errors.length > 0 ? errors : undefined,
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
