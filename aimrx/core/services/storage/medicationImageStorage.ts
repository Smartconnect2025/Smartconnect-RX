/**
 * Supabase Storage Utilities for Medication Image Upload
 * Handles medication image upload, validation, and URL generation
 * Recommended size: 400x400px for optimal display
 */

import { createClient } from "@core/supabase";

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface ImageValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  maxWidth?: number;
  maxHeight?: number;
}

const DEFAULT_VALIDATION_OPTIONS: Required<ImageValidationOptions> = {
  maxSizeBytes: 3 * 1024 * 1024, // 3MB - smaller for medication images
  allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxWidth: 1000,
  maxHeight: 1000,
};

/**
 * Validate image file before upload
 */
export function validateImageFile(
  file: File,
  options: ImageValidationOptions = {},
): { valid: boolean; error?: string } {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

  // Check file type
  if (!opts.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: JPG, PNG, WebP`,
    };
  }

  // Check file size
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
 * Generate a unique filename for medication image upload
 */
export function generateMedicationImageFilename(
  medicationName: string,
  fileExtension: string,
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const safeName = medicationName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .substring(0, 30);
  return `medications/${safeName}-${timestamp}-${randomId}.${fileExtension}`;
}

/**
 * Upload medication image to Supabase Storage
 */
export async function uploadMedicationImage(
  file: File,
  medicationName: string,
  validationOptions?: ImageValidationOptions,
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateImageFile(file, validationOptions);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const supabase = createClient();

    // Generate unique filename
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = generateMedicationImageFilename(medicationName, fileExtension);

    // Upload file to Supabase Storage
    const { error } = await supabase.storage
      .from("medication-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false, // Don't replace - keep unique filenames
      });

    if (error) {
      console.error("Upload error:", error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("medication-images")
      .getPublicUrl(fileName);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error) {
    console.error("Medication image upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete medication image from Supabase Storage
 */
export async function deleteMedicationImage(
  imageUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Extract filename from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split("/");
    const fileName = pathParts.slice(-2).join("/"); // medications/filename.jpg

    const { error } = await supabase.storage.from("medication-images").remove([fileName]);

    if (error) {
      console.error("Delete error:", error);
      return {
        success: false,
        error: `Delete failed: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Medication image delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Get optimized medication image URL with transformations
 * Recommended display sizes:
 * - Thumbnail in table: 48x48px
 * - Card view: 200x200px
 * - Detail view: 400x400px
 */
export function getOptimizedMedicationImageUrl(
  imageUrl: string,
  size: number = 400,
): string {
  if (!imageUrl) return "";

  // If it's a Supabase Storage URL, add transformation parameters
  if (imageUrl.includes("supabase")) {
    const url = new URL(imageUrl);
    url.searchParams.set("width", size.toString());
    url.searchParams.set("height", size.toString());
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", "85");
    return url.toString();
  }

  return imageUrl;
}
