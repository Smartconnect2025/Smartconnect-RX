/**
 * Reusable Avatar Upload Hook
 * Provides avatar upload functionality for both patient and provider profiles
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  uploadAvatar,
  deleteAvatar,
  getOptimizedAvatarUrl,
} from "@core/services/storage/avatarStorage";

export interface UseAvatarUploadOptions {
  userId: string;
  currentAvatarUrl?: string;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
  validationOptions?: {
    maxSizeBytes?: number;
    allowedTypes?: string[];
    maxWidth?: number;
    maxHeight?: number;
  };
}

export interface UseAvatarUploadReturn {
  // State
  isUploading: boolean;
  previewUrl: string | null;

  // Actions
  handleFileSelect: (file: File) => Promise<void>;
  handleAvatarClick: () => void;
  handleRemoveAvatar: () => Promise<void>;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Utils
  getOptimizedUrl: (size?: number) => string;
}

export function useAvatarUpload({
  userId,
  currentAvatarUrl,
  onAvatarUpdate,
  validationOptions,
}: UseAvatarUploadOptions): UseAvatarUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) return;

      setIsUploading(true);
      setPreviewUrl(null);

      try {
        const result = await uploadAvatar(file, userId, validationOptions);

        if (result.success && result.url) {
          // Set preview URL for immediate feedback
          const optimizedUrl = getOptimizedAvatarUrl(result.url, 200);
          setPreviewUrl(optimizedUrl);

          // Notify parent component
          onAvatarUpdate?.(result.url);

          toast.success("Profile picture updated successfully!");
        } else {
          toast.error(result.error || "Failed to upload image");
        }
      } catch (error) {
        console.error("Avatar upload error:", error);
        toast.error("An unexpected error occurred while uploading");
      } finally {
        setIsUploading(false);
      }
    },
    [userId, validationOptions, onAvatarUpdate],
  );

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveAvatar = useCallback(async () => {
    if (!currentAvatarUrl) return;

    try {
      const result = await deleteAvatar(currentAvatarUrl);

      if (result.success) {
        setPreviewUrl(null);
        onAvatarUpdate?.("");
        toast.success("Profile picture removed successfully!");
      } else {
        toast.error(result.error || "Failed to remove image");
      }
    } catch (error) {
      console.error("Avatar removal error:", error);
      toast.error("An unexpected error occurred while removing image");
    }
  }, [currentAvatarUrl, onAvatarUpdate]);

  const getOptimizedUrl = useCallback(
    (size: number = 200) => {
      const urlToUse = previewUrl || currentAvatarUrl;
      return urlToUse ? getOptimizedAvatarUrl(urlToUse, size) : "";
    },
    [previewUrl, currentAvatarUrl],
  );

  return {
    isUploading,
    previewUrl,
    handleFileSelect,
    handleAvatarClick,
    handleRemoveAvatar,
    fileInputRef,
    getOptimizedUrl,
  };
}
