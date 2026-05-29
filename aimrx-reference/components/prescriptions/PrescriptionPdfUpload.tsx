"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, File, X, CheckCircle } from "lucide-react";

interface PrescriptionPdfUploadProps {
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  selectedFile?: File | null;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function PrescriptionPdfUpload({
  onFileSelect,
  onRemove,
  selectedFile,
  error,
}: PrescriptionPdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setValidationError("");

    if (file.type !== "application/pdf") {
      setValidationError("Only PDF files are allowed");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError("File too large. Maximum size: 10MB");
      return false;
    }

    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleRemove = () => {
    setValidationError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemove();
  };

  const displayError = error || validationError;

  if (selectedFile) {
    return (
      <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${displayError ? "border-red-500 bg-red-50" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />
        <FileUp
          className={`h-10 w-10 mx-auto mb-4 ${displayError ? "text-red-400" : "text-gray-400"}`}
        />
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium text-blue-600">Click to upload</span> or
          drag and drop
        </p>
        <p className="text-xs text-gray-500">PDF only (max 10MB)</p>
        <p className="text-xs text-gray-400 mt-2">
          Optional
        </p>
      </div>
      {displayError && <p className="text-sm text-red-600">{displayError}</p>}
    </div>
  );
}

export function PrescriptionPdfPreview({
  file,
  storagePath,
  onView,
}: {
  file?: File | null;
  storagePath?: string | null;
  onView?: () => void;
}) {
  if (!file && !storagePath) {
    return (
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <File className="h-5 w-5 text-gray-400" />
        <span className="text-sm text-gray-500">No PDF attached</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <File className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {file?.name || "Prescription PDF"}
          </p>
          {file && (
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
      </div>
      {onView && (
        <Button type="button" variant="outline" size="sm" onClick={onView}>
          View PDF
        </Button>
      )}
    </div>
  );
}
