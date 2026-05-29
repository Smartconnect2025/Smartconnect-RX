/**
 * Supabase Storage Utilities for Avatar Upload
 * Handles image upload, validation, and URL generation for profile pictures
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
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxWidth: 2048,
  maxHeight: 2048,
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
      error: `Invalid file type. Allowed types: ${opts.allowedTypes.join(", ")}`,
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
 * Generate a unique filename for avatar upload
 */
export function generateAvatarFilename(
  userId: string,
  fileExtension: string,
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `avatars/${userId}/${timestamp}-${randomId}.${fileExtension}`;
}

/**
 * Upload avatar image to Supabase Storage
 */
export async function uploadAvatar(
  file: File,
  userId: string,
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
    const fileName = generateAvatarFilename(userId, fileExtension);

    // Upload file to Supabase Storage
    const { error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true, // Replace existing file with same name
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
      .from("avatars")
      .getPublicUrl(fileName);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error) {
    console.error("Avatar upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete avatar from Supabase Storage
 */
export async function deleteAvatar(
  avatarUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Extract filename from URL
    const url = new URL(avatarUrl);
    const pathParts = url.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const fullPath = `avatars/${pathParts[pathParts.length - 2]}/${fileName}`;

    const { error } = await supabase.storage.from("avatars").remove([fullPath]);

    if (error) {
      console.error("Delete error:", error);
      return {
        success: false,
        error: `Delete failed: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Avatar delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Get optimized avatar URL with transformations
 */
export function getOptimizedAvatarUrl(
  avatarUrl: string,
  size: number = 200,
): string {
  if (!avatarUrl) return "";

  // If it's already a Supabase Storage URL, add transformation parameters
  if (avatarUrl.includes("supabase")) {
    const url = new URL(avatarUrl);
    url.searchParams.set("width", size.toString());
    url.searchParams.set("height", size.toString());
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", "80");
    return url.toString();
  }

  return avatarUrl;
}
