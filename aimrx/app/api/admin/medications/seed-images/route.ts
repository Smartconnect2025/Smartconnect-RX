import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

const MEDICATION_IMAGES: Record<string, string> = {
  "5-Amino capsule 50mg": "/catalog/med-5-amino-capsule.png",
  "AOD 9604 - 1.2 mg/mL": "/catalog/med-aod-9604.png",
  "AOD-9604/MOTs-C 1.2mg/2mg/mL": "/catalog/med-aod9604-motsc.png",
  "AOD-9604/MOTs-C/Tesamorelin": "/catalog/med-aod9604-motsc-tesamorelin.png",
  "BPC - 157 capsules": "/catalog/med-bpc157-capsules.png",
  "BPC-157 3MG/ML": "/catalog/med-bpc157.png",
  "BPC-157/GHK-U/KPV/TB500 3mg/10mg/3mg/3mg/mL": "/catalog/med-bpc157-ghku-kpv-tb500.png",
  "BPC-157/KPV/TB500 3mg/3mg/3mg/Ml": "/catalog/med-bpc157-kpv-tb500.png",
  "BPC-157/TB-500/GHKU 3/3/10MG/ML": "/catalog/med-bpc157-tb500-ghku.png",
  "BPC-157/TB500 3mg/3mg/mL": "/catalog/med-bpc157-tb500.png",
  "BPC-157/TB500 capsules": "/catalog/med-bpc157-tb500-capsules.png",
  "CJC/Ipamorelin 1.2mg/2mg": "/catalog/med-cjc-ipamorelin.png",
  "Dihexa capsules 5mg": "/catalog/med-dihexa-capsules.png",
  "Dihexa/Tesofensine capsules 5mg/500mcg": "/catalog/med-dihexa-tesofensine.png",
  "DSIP 1mg/mL": "/catalog/med-dsip.png",
  "DSIP/BPC/CJC 1mg/2mg/2mg": "/catalog/med-dsip-bpc-cjc.png",
  "Epithalon 2mg/mL": "/catalog/med-epithalon.png",
  "GHK-Cu 10mb/mL": "/catalog/med-ghk-cu.png",
  "GHK-Cu/Epithalon 10mg/2mg//mL": "/catalog/med-ghk-cu-epithalon.png",
  "Glutathione 200mcg/mL": "/catalog/med-glutathione.png",
  "Gonadorelin 1mg/mL": "/catalog/med-gonadorelin.png",
  "Ibutamoren(MK-677) capsules 25mg": "/catalog/med-ibutamoren-mk677.png",
  "IGF-LR3 200mcg/mL": "/catalog/med-igf-lr3.png",
  "Kisspeptin 1mg/mL": "/catalog/med-kisspeptin.png",
  "LIPO-B 50mg/50mg/25mg/1mg/mL": "/catalog/med-lipo-b.png",
  "LL-37 2mg/5mg": "/catalog/med-ll37.png",
  "MOTS-C 2mg/mL": "/catalog/med-motsc.png",
  "NAD+ 100mg/mL": "/catalog/med-nad-plus.png",
  "Ondansetron 4mg tablet": "/catalog/med-ondansetron.png",
  "Pinealon/PE22-28/Selank 2mg/2mg/2mg/mL": "/catalog/med-pinealon-pe22-selank.png",
  "PT-141 2mg/Ml": "/catalog/med-pt141.png",
  "Sema 2mg,4mg,6mg": "/catalog/med-sema-2mg-4mg-6mg.png",
  "Sema 4mg,6mg,10mg": "/catalog/med-sema-4mg-6mg-10mg.png",
  "Sema maintenance 10mg x 3 vials": "/catalog/med-sema-maintenance-10mg.png",
  "Sema Starter 1mg,2mg,4mg/ml": "/catalog/med-sema-starter.png",
  "Semaglutide + B12 Injection 10mg/0.5mg/mL": "/catalog/med-sema-b12-10mg.png",
  "Semaglutide + B12 Injection 1mg/0.5mg/mL": "/catalog/med-sema-b12-1mg.png",
  "Semaglutide + B12 Injection 2mg/0.5mg/mL": "/catalog/med-semaglutide.png",
  "Semaglutide + B12 Injection 4mg/0.5mg/mL": "/catalog/med-sema-b12-4mg.png",
  "Semaglutide + B12 Injection 6mg/0.5mg/mL": "/catalog/med-sema-b12-6mg.png",
  "Semax/Selank 1mg/1mg": "/catalog/med-semax-selank.png",
  "Sermorelin 3mg/Ml": "/catalog/med-sermorelin.png",
  "SLU_PP 332/BAM 15 capsule 100mcg/15mg": "/catalog/med-slupp332-bam15.png",
  "SLU-PP 332 capsules 250mcg": "/catalog/med-slupp332.png",
  "Tesamorelin 3mg/mL": "/catalog/med-tesamorelin.png",
  "Tesamorelin/Ipamorelin 3mg/2mg/mL": "/catalog/med-tesamorelin-ipamorelin.png",
  "Tesofensine capsules 500mcg": "/catalog/med-tesofensine.png",
  "Thymosin A-1 1mg/Ml": "/catalog/med-thymosin-a1.png",
  "Tirz 20mg 25mg,30 mg": "/catalog/med-tirz-20mg-25mg-30mg.png",
  "Tirz maintenance 25mg x 3 vials": "/catalog/med-tirz-maintenance-25mg.png",
  "Tirz maintence 20mg x 3 vials": "/catalog/med-tirz-maintenance-20mg.png",
  "Tirz maintence 30mg x 3 vials": "/catalog/med-tirz-maintenance-30mg.png",
  "Tirz Starter 3 mth 5mg,10mg,15mg/ml": "/catalog/med-tirz-starter.png",
  "Tirzepatide + B12 Injection 10mg/0.5mg/mL": "/catalog/med-tirz-b12-10mg.png",
  "Tirzepatide + B12 Injection 15mg/0.5mg/mL": "/catalog/med-tirz-b12-15mg.png",
  "Tirzepatide + B12 Injection 20mg/0.5mg/mL": "/catalog/med-tirz-b12-20mg.png",
  "Tirzepatide + B12 Injection 25mg/0.5mg/mL": "/catalog/med-tirz-b12-25mg.png",
  "Tirzepatide + B12 Injection 30mg/0.5mg/mL": "/catalog/med-tirz-b12-30mg.png",
  "Tirzepatide + B12 Injection 5mg/0.5mg/mL": "/catalog/med-tirzepatide.png",
};

export async function POST() {
  try {
    const supabase = createAdminClient();

    const { data: allMeds, error: fetchError } = await supabase
      .from("pharmacy_medications")
      .select("id, name, image_url");

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    const results: { name: string; status: string }[] = [];
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const med of allMeds || []) {
      const imageUrl = MEDICATION_IMAGES[med.name];
      if (!imageUrl) {
        results.push({ name: med.name, status: "no_mapping" });
        notFound++;
        continue;
      }
      if (med.image_url) {
        results.push({ name: med.name, status: "already_has_image" });
        skipped++;
        continue;
      }
      const { error: updateError } = await supabase
        .from("pharmacy_medications")
        .update({ image_url: imageUrl })
        .eq("id", med.id);

      if (updateError) {
        results.push({ name: med.name, status: `error: ${updateError.message}` });
      } else {
        results.push({ name: med.name, status: "updated" });
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: { total: allMeds?.length || 0, updated, skipped, notFound },
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
