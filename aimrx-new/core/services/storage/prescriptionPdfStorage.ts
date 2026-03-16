/**
 * Supabase Storage Utilities for Prescription PDF Upload
 * Handles PDF upload, validation, and URL generation for prescription documents
 * Stores files in the patient-files bucket with proper tracking in patient_documents table
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface PrescriptionPdfUploadResult {
  success: boolean;
  storagePath?: string;
  signedUrl?: string;
  documentId?: string;
  error?: string;
}

export interface PdfValidationOptions {
  maxSizeBytes?: number;
}

const DEFAULT_VALIDATION_OPTIONS = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
};

const ALLOWED_MIME_TYPES = ["application/pdf"];

/**
 * Generate storage path for prescription PDF
 * Path structure: prescriptions/{patientId}/{prescriptionId}/{timestamp}.pdf
 */
export function generatePrescriptionPdfPath(
  patientId: string,
  prescriptionId: string
): string {
  const timestamp = Date.now();
  return `prescriptions/${patientId}/${prescriptionId}/${timestamp}.pdf`;
}

/**
 * Validate PDF file before upload
 */
export function validatePdfFile(
  file: File,
  options: PdfValidationOptions = {}
): { valid: boolean; error?: string } {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Only PDF files are allowed for prescriptions",
    };
  }

  if (file.size > opts.maxSizeBytes) {
    const maxSizeMB = Math.round(opts.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Upload prescription PDF to Supabase Storage and create patient_documents record
 */
export async function uploadPrescriptionPdf(
  supabase: SupabaseClient,
  file: File,
  patientId: string,
  prescriptionId: string,
  uploadedBy: string
): Promise<PrescriptionPdfUploadResult> {
  // Validate file
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const storagePath = generatePrescriptionPdfPath(patientId, prescriptionId);

  try {
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("patient-files")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("📄 [Storage] Upload error:", uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Create signed URL (7 days expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("patient-files")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("📄 [Storage] Signed URL error:", signedUrlError);
      // Clean up on failure
      await supabase.storage.from("patient-files").remove([storagePath]);
      return { success: false, error: "Failed to generate signed URL" };
    }

    // Create patient_documents record
    const { data: document, error: dbError } = await supabase
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        prescription_id: prescriptionId,
        uploaded_by: uploadedBy,
        name: file.name,
        file_type: "pdf",
        mime_type: file.type,
        file_size: file.size,
        file_url: signedUrlData.signedUrl,
        storage_path: storagePath,
        document_category: "prescription",
      })
      .select()
      .single();

    if (dbError) {
      console.error("📄 [Storage] Database insert error:", dbError);
      // Clean up on failure
      await supabase.storage.from("patient-files").remove([storagePath]);
      return { success: false, error: `Database error: ${dbError.message}` };
    }

    // Update prescription with PDF reference
    const { error: updateError } = await supabase
      .from("prescriptions")
      .update({
        pdf_storage_path: storagePath,
        pdf_document_id: document.id,
      })
      .eq("id", prescriptionId);

    if (updateError) {
      console.error("📄 [Storage] Failed to update prescription with PDF reference:", updateError);
      // Don't fail the whole operation, the document was still created
    }

    return {
      success: true,
      storagePath,
      signedUrl: signedUrlData.signedUrl,
      documentId: document.id,
    };
  } catch (error) {
    console.error("📄 [Storage] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Get prescription PDF as base64 string
 * Downloads the file from storage and converts it to base64
 */
export async function getPrescriptionPdfBase64(
  supabase: SupabaseClient,
  storagePath: string
): Promise<{ base64?: string; error?: string }> {
  try {
    // Download the file from storage
    const { data, error } = await supabase.storage
      .from("patient-files")
      .download(storagePath);

    if (error || !data) {
      console.error("📄 [Storage] Error downloading PDF:", error);
      return { error: error?.message || "Failed to download PDF" };
    }

    // Convert blob to base64
    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { base64 };
  } catch (error) {
    console.error("📄 [Storage] Error converting PDF to base64:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to convert PDF to base64",
    };
  }
}

/**
 * Get fresh signed URL for prescription PDF
 */
export async function getPrescriptionPdfUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn: number = 60 * 60 * 24 // 24 hours default
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from("patient-files")
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return { error: error?.message || "Failed to generate URL" };
  }

  return { url: data.signedUrl };
}

/**
 * Delete prescription PDF from storage and database
 */
export async function deletePrescriptionPdf(
  supabase: SupabaseClient,
  storagePath: string,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("patient-files")
      .remove([storagePath]);

    if (storageError) {
      return { success: false, error: `Storage delete failed: ${storageError.message}` };
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("patient_documents")
      .delete()
      .eq("id", documentId);

    if (dbError) {
      return { success: false, error: `Database delete failed: ${dbError.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}
