"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowLeft,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface UploadResult {
  success: boolean;
  message: string;
  imported: number;
  failed: number;
  errors?: string[];
}

interface Pharmacy {
  id: string;
  name: string;
  is_active: boolean;
}

export default function BulkUploadMedicationsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>("");
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);

  useEffect(() => {
    const loadPharmacies = async () => {
      try {
        const response = await fetch("/api/admin/pharmacies");
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.pharmacies) {
          const activePharmacies = data.pharmacies.filter((p: Pharmacy) => p.is_active);
          setPharmacies(activePharmacies);
          if (activePharmacies.length === 1) {
            setIsPharmacyAdmin(true);
            setSelectedPharmacyId(activePharmacies[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading pharmacies:", error);
      }
    };
    loadPharmacies();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleDismissError = () => {
    setUploadResult(null);
    setFile(null);
    const fileInput = document.getElementById("upload-file") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleUpload = async () => {
    if (!file || !selectedPharmacyId) {
      setUploadResult({
        success: false,
        message: "Please select a pharmacy before uploading",
        imported: 0,
        failed: 0,
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pharmacy_id", selectedPharmacyId);

      const response = await fetch("/api/admin/medications/bulk-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadResult(data);

      if (data.success) {
        setFile(null);
        const fileInput = document.getElementById("upload-file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadResult({
        success: false,
        message: "Failed to upload file",
        imported: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templateRows = [
      {
        name: "LIPO-B Injection",
        strength: "50mg/50mg/25mg/1mg/mL",
        vial_size: "10mL",
        form: "Injection",
        ndc: "12345-678-90",
        retail_price: 25.00,
        aimrx_price: 50.00,
        category: "Weight Loss & Metabolism",
        dosage_instructions: "Inject 1 mL into the muscle two times a week.",
        description: "A lipotropic injection blend for fat metabolism, energy production, and liver function.",
        in_stock: "TRUE",
        preparation_time_days: 0,
        notes: "Refrigerate upon receipt",
        ingredient_1_name: "Cyanocobalamin (Vitamin B12)",
        ingredient_1_dose: "1 mg/mL",
        ingredient_2_name: "Inositol",
        ingredient_2_dose: "50 mg/mL",
        ingredient_3_name: "Methionine",
        ingredient_3_dose: "25 mg/mL",
        ingredient_4_name: "Choline Chloride",
        ingredient_4_dose: "50 mg/mL",
        ingredient_5_name: "",
        ingredient_5_dose: "",
        ingredient_6_name: "",
        ingredient_6_dose: "",
      },
      {
        name: "Semaglutide + B12 Injection",
        strength: "10mg/0.5mg/mL",
        vial_size: "1mL",
        form: "Injection",
        ndc: "33333-222-11",
        retail_price: 90.00,
        aimrx_price: 110.00,
        category: "Weight Loss & Metabolism",
        dosage_instructions: "Inject subcutaneously once weekly as directed by provider.",
        description: "GLP-1 receptor agonist with B12 for weight management.",
        in_stock: "TRUE",
        preparation_time_days: 0,
        notes: "Keep refrigerated",
        ingredient_1_name: "Semaglutide",
        ingredient_1_dose: "10 mg/mL",
        ingredient_2_name: "Cyanocobalamin (Vitamin B12)",
        ingredient_2_dose: "0.5 mg/mL",
        ingredient_3_name: "",
        ingredient_3_dose: "",
        ingredient_4_name: "",
        ingredient_4_dose: "",
        ingredient_5_name: "",
        ingredient_5_dose: "",
        ingredient_6_name: "",
        ingredient_6_dose: "",
      },
      {
        name: "BPC-157 Capsules",
        strength: "500mcg",
        vial_size: "60 capsules",
        form: "Capsule",
        ndc: "55555-444-33",
        retail_price: 45.00,
        aimrx_price: 55.00,
        category: "Anti-Inflammatory & Healing",
        dosage_instructions: "Take 1 capsule twice daily",
        description: "Peptide that promotes healing and recovery",
        in_stock: "TRUE",
        preparation_time_days: 0,
        notes: "Store in cool dry place",
        ingredient_1_name: "",
        ingredient_1_dose: "",
        ingredient_2_name: "",
        ingredient_2_dose: "",
        ingredient_3_name: "",
        ingredient_3_dose: "",
        ingredient_4_name: "",
        ingredient_4_dose: "",
        ingredient_5_name: "",
        ingredient_5_dose: "",
        ingredient_6_name: "",
        ingredient_6_dose: "",
      },
      {
        name: "NAD+ IV Therapy",
        strength: "500mg",
        vial_size: "10mL",
        form: "Injection",
        ndc: "77777-666-55",
        retail_price: 150.00,
        aimrx_price: 180.00,
        category: "NAD+ & Biohacking",
        dosage_instructions: "Administer IV as directed",
        description: "Anti-aging and cellular energy support via IV infusion.",
        in_stock: "TRUE",
        preparation_time_days: 5,
        notes: "Compounded to order",
        ingredient_1_name: "NAD+ (Nicotinamide Adenine Dinucleotide)",
        ingredient_1_dose: "500 mg",
        ingredient_2_name: "",
        ingredient_2_dose: "",
        ingredient_3_name: "",
        ingredient_3_dose: "",
        ingredient_4_name: "",
        ingredient_4_dose: "",
        ingredient_5_name: "",
        ingredient_5_dose: "",
        ingredient_6_name: "",
        ingredient_6_dose: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);

    const colWidths = [
      { wch: 32 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
      { wch: 50 },
      { wch: 50 },
      { wch: 10 },
      { wch: 22 },
      { wch: 30 },
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 14 },
    ];
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medications");

    XLSX.writeFile(wb, "smartconnect-rx-medication-upload-template.xlsx");
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/medication-catalog")}
          className="mb-4 -ml-2"
          data-testid="button-back-catalog"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Catalog
        </Button>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">
          Bulk Upload Medications
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Add multiple medications at once using an Excel spreadsheet
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4" />
            How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              { step: "1", text: "Download the Excel template" },
              { step: "2", text: "Fill in your medications — one per row" },
              { step: "3", text: "Upload and you're done" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
                <span className="text-sm text-blue-800">{item.text}</span>
              </div>
            ))}
          </div>
          <div className="bg-white/60 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Only name and price are required.</strong> Everything else is optional — leave any column blank if you don&apos;t have the data. The template has example medications you can delete or replace with your own.
            </p>
          </div>
          <div className="bg-white/60 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Ingredients are easy:</strong> Each ingredient gets its own pair of columns — just type the name in one cell and the dose in the next. Up to 6 ingredients per medication. Leave blank if there are no ingredients.
            </p>
          </div>
          <Button
            onClick={downloadTemplate}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-download-template"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Excel Template
          </Button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Upload Your Spreadsheet</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="pharmacy-select" className="block text-sm font-medium text-gray-700 mb-1.5">
                Pharmacy
              </label>
              {isPharmacyAdmin ? (
                <div className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm">
                  {pharmacies.length > 0 ? pharmacies[0].name : "Your Pharmacy"}
                </div>
              ) : (
                <select
                  id="pharmacy-select"
                  value={selectedPharmacyId}
                  onChange={(e) => setSelectedPharmacyId(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="select-pharmacy"
                >
                  <option value="">Choose a pharmacy</option>
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="upload-file" className="block text-sm font-medium text-gray-700 mb-1.5">
                Excel File
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
                <input
                  id="upload-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-upload-file"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-900">{file.name}</span>
                    <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <label htmlFor="upload-file" className="cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      <span className="text-blue-600 font-medium">Click to browse</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Excel (.xlsx) or CSV files</p>
                  </label>
                )}
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !selectedPharmacyId || isUploading}
              className="w-full h-11"
              data-testid="button-upload"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload and Import
                </>
              )}
            </Button>
          </div>
        </div>

        {uploadResult && (
          <div
            className={`border rounded-xl p-5 relative ${
              uploadResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}
            data-testid="upload-result"
          >
            <button
              onClick={handleDismissError}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              data-testid="button-dismiss-result"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-start gap-3">
              {uploadResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-semibold ${uploadResult.success ? "text-green-900" : "text-red-900"}`}>
                  {uploadResult.success ? "Upload Successful" : "Upload Failed"}
                </p>
                <p className={`text-sm mt-1 ${uploadResult.success ? "text-green-700" : "text-red-700"}`}>
                  {uploadResult.message}
                </p>
                {uploadResult.imported > 0 && (
                  <p className="text-sm text-green-700 mt-1">
                    {uploadResult.imported} medication(s) imported
                  </p>
                )}
                {uploadResult.failed > 0 && (
                  <p className="text-sm text-red-700 mt-1">{uploadResult.failed} failed</p>
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {uploadResult.errors.map((error, index) => (
                      <p key={index} className="text-xs text-red-600 font-mono bg-red-100/50 px-2 py-1 rounded">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
