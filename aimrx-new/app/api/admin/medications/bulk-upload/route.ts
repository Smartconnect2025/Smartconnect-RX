import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { createServerClient } from "@core/supabase/server";
import { getPharmacyAdminScope } from "@core/auth/api-guards";
import * as XLSX from "xlsx";

interface RawRow {
  [key: string]: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSV(text: string): RawRow[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else if (char === '\r') {
      continue;
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: RawRow = {};

    headers.forEach((header, index) => {
      row[header.trim().toLowerCase().replace(/\s+/g, "_")] = values[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

function parseExcel(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return jsonData.map((row) => {
    const mapped: RawRow = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
      mapped[cleanKey] = String(value ?? "").trim();
    }
    return mapped;
  });
}

function buildDetailedDescription(row: RawRow): string | null {
  const ingredients: { name: string; dose: string }[] = [];

  for (let i = 1; i <= 10; i++) {
    const name = (row[`ingredient_${i}_name`] || "").trim();
    const dose = (row[`ingredient_${i}_dose`] || "").trim();
    if (name) {
      ingredients.push({ name, dose });
    }
  }

  const descriptionText = (row["description"] || row["detailed_description"] || "").trim();

  if (ingredients.length === 0 && !descriptionText) {
    return null;
  }

  if (ingredients.length === 0) {
    return descriptionText;
  }

  let result = "Active Ingredients:\n";
  for (const ing of ingredients) {
    if (ing.dose) {
      result += `• ${ing.name} — ${ing.dose}\n`;
    } else {
      result += `• ${ing.name}\n`;
    }
  }

  if (descriptionText) {
    result += `\n${descriptionText}`;
  }

  return result.trim();
}

function getField(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    const val = (row[key] || "").trim();
    if (val) return val;
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createServerClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRole } = await authSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const scope = await getPharmacyAdminScope(user.id);
    const isPlatformAdmin = userRole?.role === "admin" || userRole?.role === "super_admin";

    if (!isPlatformAdmin && !scope.isPharmacyAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    let pharmacyId = formData.get("pharmacy_id") as string;

    if (scope.isPharmacyAdmin) {
      if (!scope.pharmacyId) {
        return NextResponse.json(
          { success: false, message: "Pharmacy admin has no linked pharmacy", imported: 0, failed: 0 },
          { status: 403 }
        );
      }
      pharmacyId = scope.pharmacyId;
    }

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded", imported: 0, failed: 0 },
        { status: 400 }
      );
    }

    if (!pharmacyId) {
      return NextResponse.json(
        { success: false, message: "Pharmacy selection is required", imported: 0, failed: 0 },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { success: false, message: "Please upload an Excel (.xlsx) or CSV (.csv) file.", imported: 0, failed: 0 },
        { status: 400 }
      );
    }

    let rows: RawRow[];

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      rows = parseExcel(buffer);
    } else {
      const text = await file.text();
      rows = parseCSV(text);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "File is empty or has no data rows", imported: 0, failed: 0 },
        { status: 400 }
      );
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const name = getField(row, "name");
        const priceStr = getField(row, "retail_price", "retail_price_cents");

        if (!name || !priceStr) {
          errors.push(
            `Row ${rowNumber}: Missing required fields (name="${name || 'empty'}", price="${priceStr || 'empty'}")`
          );
          failed++;
          continue;
        }

        const retailPriceCents = Math.round(parseFloat(priceStr) * 100);
        if (isNaN(retailPriceCents) || retailPriceCents < 0) {
          errors.push(`Row ${rowNumber}: Invalid price "${priceStr}"`);
          failed++;
          continue;
        }

        let aimrxSitePricingCents: number | null = null;
        const aimrxStr = getField(row, "aimrx_price", "aimrx_site_pricing_cents");
        if (aimrxStr) {
          const parsed = Math.round(parseFloat(aimrxStr) * 100);
          if (!isNaN(parsed) && parsed >= 0) {
            aimrxSitePricingCents = parsed;
          }
        }

        const inStockStr = getField(row, "in_stock");
        const inStock = inStockStr.toLowerCase() === "false" ? false : true;

        let preparationTimeDays: number | null = null;
        const prepStr = getField(row, "preparation_time_days");
        if (prepStr) {
          const parsedDays = parseInt(prepStr);
          if (!isNaN(parsedDays) && parsedDays >= 0 && parsedDays <= 30) {
            preparationTimeDays = parsedDays;
          }
        }

        const detailedDescription = buildDetailedDescription(row);

        const { error: insertError } = await supabase
          .from("pharmacy_medications")
          .insert({
            pharmacy_id: pharmacyId,
            name: name,
            strength: getField(row, "strength") || null,
            vial_size: getField(row, "vial_size") || null,
            form: getField(row, "form") || "Injection",
            ndc: getField(row, "ndc") || null,
            retail_price_cents: retailPriceCents,
            aimrx_site_pricing_cents: aimrxSitePricingCents,
            category: getField(row, "category") || null,
            dosage_instructions: getField(row, "dosage_instructions") || null,
            detailed_description: detailedDescription,
            is_active: true,
            in_stock: inStock,
            preparation_time_days: preparationTimeDays,
            notes: getField(row, "notes") || null,
          });

        if (insertError) {
          console.error(`Error inserting row ${rowNumber}:`, insertError);
          errors.push(`Row ${rowNumber}: Database error - ${insertError.message}`);
          failed++;
        } else {
          imported++;
        }

      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
        failed++;
      }
    }

    const success = imported > 0;
    const message = success
      ? `Successfully imported ${imported} medication(s)`
      : "Failed to import any medications";

    return NextResponse.json({
      success,
      message,
      imported,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Server error during upload",
        imported: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      },
      { status: 500 }
    );
  }
}
