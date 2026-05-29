"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind-utils";
import {
  uploadImage,
  deleteImage,
  isSupabaseStorageUrl,
} from "@/core/services/imageUploadService";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onError?: (error: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const RECOMMENDED_DIMENSIONS = "800x800px";

export function ImageUpload({
  value,
  onChange,
  onError,
  onUploadingChange,
  disabled = false,
  className,
}: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Please upload JPG, PNG, or WebP images.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size too large. Please upload images smaller than 5MB.`;
    }
    return null;
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return;
      }

      setIsUploading(true);
      setError(null);
      onUploadingChange?.(true);

      try {
        // Create a preview URL for immediate display
        const previewUrl = URL.createObjectURL(file);
        onChange(previewUrl);

        // Upload to Supabase Storage
        const result = await uploadImage(file, {
          bucket: "products",
          folder: "images",
        });

        if (result.success && result.url) {
          // Clean up the preview URL
          URL.revokeObjectURL(previewUrl);
          onChange(result.url);
        } else {
          // Upload failed, revert to empty
          onChange("");
          const errorMessage =
            result.error || "Failed to upload image. Please try again.";
          setError(errorMessage);
          onError?.(errorMessage);
        }
      } catch {
        const errorMessage = "Failed to upload image. Please try again.";
        setError(errorMessage);
        onError?.(errorMessage);
        onChange("");
      } finally {
        setIsUploading(false);
        onUploadingChange?.(false);
      }
    },
    [onChange, onError, onUploadingChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload, disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleRemoveImage = async () => {
    // If the current image is from Supabase Storage, delete it
    if (value && isSupabaseStorageUrl(value)) {
      try {
        await deleteImage(value, "products");
      } catch (error) {
        console.error("Failed to delete image from storage:", error);
        // Continue with removal even if storage deletion fails
      }
    }

    onChange("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragOver && !disabled
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed",
          error && "border-destructive",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {value ? (
          <div className="space-y-4">
            <div className="relative group">
              <img
                src={value}
                alt="Product preview"
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  disabled={disabled}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClick}
                disabled={disabled || isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Replace Image"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
              {isUploading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {isUploading ? "Uploading image..." : "Upload product image"}
              </p>
              <p className="text-xs text-muted-foreground">
                Drag and drop or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Recommended: {RECOMMENDED_DIMENSIONS} • Max 5MB
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP supported
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
