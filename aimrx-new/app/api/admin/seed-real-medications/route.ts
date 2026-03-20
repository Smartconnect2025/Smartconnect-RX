import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST() {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const supabase = await createServerClient();

  try {
    // Get BOTH pharmacy IDs
    const { data: aimPharmacy } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("slug", "aim")
      .single();

    const { data: grinethchPharmacy } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("slug", "grinethch")
      .single();

    if (!aimPharmacy || !grinethchPharmacy) {
      return NextResponse.json(
        { error: "Pharmacies not found" },
        { status: 404 }
      );
    }

    const aimId = aimPharmacy.id;
    const grinethchId = grinethchPharmacy.id;

    // 1. DELETE ALL OLD MEDICATIONS
    const { error: deleteError } = await supabase
      .from("pharmacy_medications")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (deleteError) {
      console.error("Error deleting old medications:", deleteError);
    }

    // 2. SEED 40 REAL HIGH-PROFIT MEDICATIONS (20 AIM + 20 Greenwich from Excel)
    const realMedications = [
      // === AIM MEDICAL TECHNOLOGIES (20 high-profit peptides/GLP-1, 100% markup) ===
      {
        pharmacy_id: aimId,
        name: "AOD 9604 - 1.2 mg/mL (5ml)",
        strength: "5mL",
        form: "Injection",
        dosage_instructions: "Inject 20 units under the skin in the mornings on days Monday through Friday, on an empty stomach",
        retail_price_cents: 6500,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "AOD-9604/MOTs-C 1.2mg/2mg/mL (5mL)",
        strength: "5mL",
        form: "Injection",
        dosage_instructions: "Inject 20 units under the skin in the mornings on days Monday through Friday, on an empty stomach",
        retail_price_cents: 9000,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Tirzepatide + B12 Injection 30mg/0.5mg/mL",
        strength: "2mL",
        form: "Injection",
        dosage_instructions: "Inject 50 units under the skin once weekly",
        retail_price_cents: 16000,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Retatrutide + B12 Injection 24mg/0.5mg/mL",
        strength: "2mL",
        form: "Injection",
        dosage_instructions: "Inject 50 units under the skin once weekly",
        retail_price_cents: 36000,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Semaglutide + B12 Injection 10mg/0.5mg/mL",
        strength: "1mL",
        form: "Injection",
        dosage_instructions: "Inject 25 units under the skin once weekly",
        retail_price_cents: 7000,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "BPC-157 3MG/ML",
        strength: "5mL",
        form: "Injection",
        dosage_instructions: "Inject 20 units daily at injury site",
        retail_price_cents: 6500,

        category: "Peptides & Growth Hormone",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "CJC-1295 + Ipamorelin 1.2mg/2mg",
        strength: "5mL",
        form: "Injection",
        dosage_instructions: "Inject 20 units before bed M-F",
        retail_price_cents: 9900,

        category: "Peptides & Growth Hormone",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "TB-500 5mg",
        strength: "5mg vial",
        form: "Injection",
        dosage_instructions: "Inject 2.5mg twice weekly",
        retail_price_cents: 9000,

        category: "Peptides & Growth Hormone",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "GHK-Cu 50mg",
        strength: "50mg vial",
        form: "Injection",
        dosage_instructions: "Topical or inject as directed",
        retail_price_cents: 8900,

        category: "Peptides & Growth Hormone",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "PT-141 10mg",
        strength: "10mg vial",
        form: "Injection",
        dosage_instructions: "Inject 0.5mg 45min before activity",
        retail_price_cents: 10000,

        category: "Sexual Health",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "NAD+ 500mg",
        strength: "500mg vial",
        form: "Injection",
        dosage_instructions: "Inject 100mg weekly",
        retail_price_cents: 10000,

        category: "Anti-Aging / NAD+",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Epitalon 10mg",
        strength: "10mg vial",
        form: "Injection",
        dosage_instructions: "Inject 5mg twice monthly",
        retail_price_cents: 8000,

        category: "Anti-Aging / NAD+",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Sema Starter Bundle 1mg,2mg,4mg",
        strength: "3 vials",
        form: "Bundle",
        dosage_instructions: "Follow weekly escalation",
        retail_price_cents: 7000,

        category: "Bundles",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Tirz Starter Bundle 10mg,15mg,20mg",
        strength: "3 vials",
        form: "Bundle",
        dosage_instructions: "Follow weekly escalation",
        retail_price_cents: 16000,

        category: "Bundles",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "DSIP 5mg",
        strength: "5mg vial",
        form: "Injection",
        dosage_instructions: "Inject 20 units nightly",
        retail_price_cents: 8500,

        category: "Sleep & Recovery",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Thymosin Alpha-1 10mg",
        strength: "10mg vial",
        form: "Injection",
        dosage_instructions: "Inject for immune support",
        retail_price_cents: 11000,

        category: "Immune Health",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Tadalafil 5mg troche x30",
        strength: "30 troches",
        form: "Troche",
        dosage_instructions: "Dissolve 1 daily",
        retail_price_cents: 6000,

        category: "Sexual Health",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "Sildenafil 100mg troche x30",
        strength: "30 troches",
        form: "Troche",
        dosage_instructions: "Dissolve 1 as needed",
        retail_price_cents: 6000,

        category: "Sexual Health",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "L-Carnitine 500mg/mL",
        strength: "10mL",
        form: "Injection",
        dosage_instructions: "Inject 1mL daily",
        retail_price_cents: 5000,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: aimId,
        name: "MOTS-c 10mg",
        strength: "5mL",
        form: "Injection",
        dosage_instructions: "Inject 10 units daily",
        retail_price_cents: 12000,

        category: "Weight Loss (GLP-1)",
        image_url: null,
        is_active: true,
      },

      // === GRINETHCH PHARMACY (20 traditional Rx, 300% markup) ===
      {
        pharmacy_id: grinethchId,
        name: "Lisinopril 10mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily",
        retail_price_cents: 900, // $9

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Atorvastatin 20mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily at bedtime",
        retail_price_cents: 1200, // $12

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Metformin 500mg #180",
        strength: "180 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 twice daily with meals",
        retail_price_cents: 800, // $8

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Amlodipine 5mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily",
        retail_price_cents: 700, // $7

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Omeprazole 20mg #90",
        strength: "90 capsules",
        form: "Capsule",
        dosage_instructions: "Take 1 daily before breakfast",
        retail_price_cents: 1000, // $10

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Levothyroxine 50mcg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily on empty stomach",
        retail_price_cents: 600, // $6

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Losartan 50mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily",
        retail_price_cents: 1100, // $11

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Gabapentin 300mg #90",
        strength: "90 capsules",
        form: "Capsule",
        dosage_instructions: "Take 1 three times daily",
        retail_price_cents: 1500, // $15

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Sertraline 50mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily",
        retail_price_cents: 900, // $9

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Escitalopram 10mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily",
        retail_price_cents: 1300, // $13

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Pantoprazole 40mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily before breakfast",
        retail_price_cents: 1400, // $14

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Hydrochlorothiazide 25mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily in morning",
        retail_price_cents: 500, // $5

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Montelukast 10mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily at bedtime",
        retail_price_cents: 1600, // $16

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Bupropion XL 150mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily in morning",
        retail_price_cents: 2000, // $20

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Trazodone 50mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1-2 at bedtime",
        retail_price_cents: 800, // $8

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Meloxicam 15mg #90",
        strength: "90 tablets",
        form: "Tablet",
        dosage_instructions: "Take 1 daily with food",
        retail_price_cents: 1000, // $10

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Prednisone 10mg #21",
        strength: "21 tablets",
        form: "Tablet",
        dosage_instructions: "Take as directed, taper dose",
        retail_price_cents: 400, // $4

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Albuterol Inhaler",
        strength: "1 inhaler",
        form: "Inhaler",
        dosage_instructions: "Inhale 2 puffs as needed",
        retail_price_cents: 3500, // $35

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Fluticasone Nasal Spray",
        strength: "1 bottle",
        form: "Nasal Spray",
        dosage_instructions: "Spray 2 sprays each nostril daily",
        retail_price_cents: 2500, // $25

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
      {
        pharmacy_id: grinethchId,
        name: "Azithromycin 250mg #6",
        strength: "6 tablets",
        form: "Tablet",
        dosage_instructions: "Take 2 on day 1, then 1 daily for 4 days",
        retail_price_cents: 1800, // $18

        category: "Traditional Rx",
        image_url: null,
        is_active: true,
      },
    ];

    // Insert all medications
    const { data: insertedMeds, error: insertError } = await supabase
      .from("pharmacy_medications")
      .insert(realMedications)
      .select();

    if (insertError) {
      console.error("Error inserting medications:", insertError);
      return NextResponse.json(
        { error: "Failed to seed medications", details: insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully seeded 40 real medications (20 AIM + 20 Greenwich)",
      medications: insertedMeds,
      count: insertedMeds?.length || 0,
    });
  } catch (error) {
    console.error("Error in seed-real-medications:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
