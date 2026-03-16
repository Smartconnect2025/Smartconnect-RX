/**
 * Image Upload Service
 *
 * Handles image uploads to Supabase Storage with proper validation and error handling
 */

import { createClient } from "@/core/supabase/client";

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface ImageUploadOptions {
  bucket: string;
  folder?: string;
  fileName?: string;
  maxSizeBytes?: number;
  allowedTypes?: string[];
}

const DEFAULT_OPTIONS: Required<ImageUploadOptions> = {
  bucket: "products",
  folder: "images",
  fileName: "",
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
};

/**
 * Upload an image file to Supabase Storage
 */
export async function uploadImage(
  file: File,
  options: Partial<ImageUploadOptions> = {},
): Promise<ImageUploadResult> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Validate file
    const validationError = validateImageFile(file, config);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Generate filename if not provided
    const fileName = config.fileName || generateFileName(file);
    const filePath = `${config.folder}/${fileName}`;

    // Upload to Supabase Storage
    const supabase = createClient();

    const { error } = await supabase.storage
      .from(config.bucket)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true, // Allow overwriting existing files
      });

    if (error) {
      console.error("Supabase upload error:", error);

      // Check if it's a bucket not found error
      if (
        error.message.includes("not found") ||
        error.message.includes("does not exist")
      ) {
        return {
          success: false,
          error: `Storage bucket '${config.bucket}' does not exist. Please run the migration to create the storage bucket.`,
        };
      }

      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(config.bucket)
      .getPublicUrl(filePath);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error) {
    console.error("Image upload error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during upload",
    };
  }
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteImage(
  url: string,
  bucket: string = "products",
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract file path from URL
    const filePath = extractFilePathFromUrl(url, bucket);
    if (!filePath) {
      return { success: false, error: "Invalid image URL" };
    }

    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error("Supabase delete error:", error);
      return {
        success: false,
        error: `Delete failed: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Image delete error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during deletion",
    };
  }
}

/**
 * Validate image file before upload
 */
function validateImageFile(
  file: File,
  config: Required<ImageUploadOptions>,
): string | null {
  // Check file type
  if (!config.allowedTypes.includes(file.type)) {
    return `Invalid file type. Allowed types: ${config.allowedTypes.join(", ")}`;
  }

  // Check file size
  if (file.size > config.maxSizeBytes) {
    const maxSizeMB = Math.round(config.maxSizeBytes / (1024 * 1024));
    return `File size too large. Maximum size: ${maxSizeMB}MB`;
  }

  return null;
}

/**
 * Generate a unique filename for the uploaded file
 */
function generateFileName(file: File): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = file.name.split(".").pop() || "jpg";
  return `image-${timestamp}-${randomString}.${extension}`;
}

/**
 * Extract file path from Supabase Storage URL
 */
export function extractFilePathFromUrl(
  url: string,
  bucket: string,
): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const bucketIndex = pathParts.findIndex((part) => part === bucket);

    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      return null;
    }

    return pathParts.slice(bucketIndex + 1).join("/");
  } catch {
    return null;
  }
}

/**
 * Check if a URL is from Supabase Storage
 */
export function isSupabaseStorageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("supabase") &&
      urlObj.pathname.includes("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
