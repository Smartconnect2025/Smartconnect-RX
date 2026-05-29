import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

const CATEGORY_ASSIGNMENTS: Record<string, string> = {
  "Sema 2mg,4mg,6mg": "Weight Loss & Metabolism",
  "Sema 4mg,6mg,10mg": "Weight Loss & Metabolism",
  "Sema maintenance 10mg x 3 vials": "Weight Loss & Metabolism",
  "Sema Starter 1mg,2mg,4mg/ml": "Weight Loss & Metabolism",
  "Semaglutide + B12 Injection 1mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Semaglutide + B12 Injection 2mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Semaglutide + B12 Injection 4mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Semaglutide + B12 Injection 6mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Semaglutide + B12 Injection 10mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tirz Starter 3 mth 5mg,10mg,15mg/ml": "Weight Loss & Metabolism",
  "Tirz 20mg 25mg,30 mg": "Weight Loss & Metabolism",
  "Tirz maintenance 25mg x 3 vials": "Weight Loss & Metabolism",
  "Tirz maintence 20mg x 3 vials": "Weight Loss & Metabolism",
  "Tirz maintence 30mg x 3 vials": "Weight Loss & Metabolism",
  "Tirzepatide + B12 Injection 5mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tirzepatide + B12 Injection 10mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tirzepatide + B12 Injection 15mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tirzepatide + B12 Injection 20mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tirzepatide + B12 Injection 25mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tirzepatide + B12 Injection 30mg/0.5mg/mL": "Weight Loss & Metabolism",
  "Tesofensine capsules 500mcg": "Weight Loss & Metabolism",
  "AOD 9604 - 1.2 mg/mL": "Weight Loss & Metabolism",
  "AOD-9604/MOTs-C 1.2mg/2mg/mL": "Weight Loss & Metabolism",
  "AOD-9604/MOTs-C/Tesamorelin": "Weight Loss & Metabolism",
  "LIPO-B 50mg/50mg/25mg/1mg/mL": "Weight Loss & Metabolism",
  "SLU-PP 332 capsules 250mcg": "Weight Loss & Metabolism",
  "SLU_PP 332/BAM 15 capsule 100mcg/15mg": "Weight Loss & Metabolism",
  "5-Amino capsule 50mg": "Weight Loss & Metabolism",

  "BPC-157 3MG/ML": "Anti-Inflammatory & Healing",
  "BPC - 157 capsules": "Anti-Inflammatory & Healing",
  "BPC-157/TB500 3mg/3mg/mL": "Anti-Inflammatory & Healing",
  "BPC-157/TB500 capsules": "Anti-Inflammatory & Healing",
  "BPC-157/KPV/TB500 3mg/3mg/3mg/Ml": "Anti-Inflammatory & Healing",
  "BPC-157/TB-500/GHKU 3/3/10MG/ML": "Anti-Inflammatory & Healing",
  "BPC-157/GHK-U/KPV/TB500 3mg/10mg/3mg/3mg/mL": "Anti-Inflammatory & Healing",
  "Glutathione 200mcg/mL": "Anti-Inflammatory & Healing",

  "CJC/Ipamorelin 1.2mg/2mg": "Performance & Fitness",
  "Sermorelin 3mg/Ml": "Performance & Fitness",
  "Tesamorelin 3mg/mL": "Performance & Fitness",
  "Tesamorelin/Ipamorelin 3mg/2mg/mL": "Performance & Fitness",
  "Ibutamoren(MK-677) capsules 25mg": "Performance & Fitness",
  "IGF-LR3 200mcg/mL": "Performance & Fitness",

  "Gonadorelin 1mg/mL": "Fertility & Reproductive Health",
  "Kisspeptin 1mg/mL": "Fertility & Reproductive Health",
  "PT-141 2mg/Ml": "Fertility & Reproductive Health",

  "GHK-Cu 10mb/mL": "Longevity & Anti-Aging",
  "GHK-Cu/Epithalon 10mg/2mg//mL": "Longevity & Anti-Aging",
  "Epithalon 2mg/mL": "Longevity & Anti-Aging",

  "NAD+ 100mg/mL": "NAD+ & Biohacking",

  "Dihexa capsules 5mg": "Cognitive & Neuron Health",
  "Dihexa/Tesofensine capsules 5mg/500mcg": "Cognitive & Neuron Health",
  "Pinealon/PE22-28/Selank 2mg/2mg/2mg/mL": "Cognitive & Neuron Health",

  "Semax/Selank 1mg/1mg": "Nootropics & Stress Management",

  "DSIP 1mg/mL": "Nootropics & Stress Management",
  "DSIP/BPC/CJC 1mg/2mg/2mg": "Nootropics & Stress Management",

  "MOTS-C 2mg/mL": "Cell & Mitochondrial Health",

  "LL-37 2mg/5mg": "Anti-Inflammatory & Healing",
  "Thymosin A-1 1mg/Ml": "Anti-Inflammatory & Healing",

  "Ondansetron 4mg tablet": "Anti-Inflammatory & Healing",
};

export async function POST() {
  try {
    const { user, userRole } = await getUser();
    if (!user || !userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: allMeds, error: fetchError } = await supabase
      .from("pharmacy_medications")
      .select("id, name, category");

    if (fetchError || !allMeds) {
      return NextResponse.json({ success: false, error: fetchError?.message || "No medications found" }, { status: 500 });
    }

    const results: { name: string; category: string; status: string }[] = [];
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const med of allMeds) {
      const categoryName = CATEGORY_ASSIGNMENTS[med.name];
      if (!categoryName) {
        results.push({ name: med.name, category: "none", status: "no_mapping" });
        notFound++;
        continue;
      }

      if (med.category === categoryName) {
        results.push({ name: med.name, category: categoryName, status: "already_correct" });
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("pharmacy_medications")
        .update({ category: categoryName })
        .eq("id", med.id);

      if (updateError) {
        results.push({ name: med.name, category: categoryName, status: `error: ${updateError.message}` });
      } else {
        results.push({ name: med.name, category: categoryName, status: "updated" });
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: { total: allMeds.length, updated, skipped, notFound },
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
