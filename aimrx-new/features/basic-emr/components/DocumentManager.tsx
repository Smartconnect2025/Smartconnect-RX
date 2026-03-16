"use client";

import { Download, FileText, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface DocumentType {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  url: string;
  file?: File;
}

interface DocumentManagerProps {
  documents: DocumentType[];
  onUpload: (files: File[]) => void;
  onView: (document: DocumentType) => void;
  onDelete: (documentId: string) => void;
  onDownload?: (document: DocumentType) => void;
}

export function DocumentManager({
  documents,
  onUpload,
  onView,
  onDelete,
  onDownload,
}: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = (doc: DocumentType) => {
    if (onDownload) {
      onDownload(doc);
    } else {
      // Default download behavior
      const link = document.createElement("a");
      link.href = doc.url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading ${doc.name}`);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    fileArray.forEach((file) => {
      // Validate file type
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error(
          `File type ${file.type} is not supported. Please upload PNG, JPEG, or PDF files.`,
        );
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      onUpload(validFiles);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "image":
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatUploadDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <Button
          className="bg-primary hover:bg-primary/90 text-white w-full sm:w-auto"
          onClick={handleUploadClick}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Upload className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-600 mb-2">No documents uploaded yet</p>
            <p className="text-sm text-gray-500">
              Click &quot;Upload Document&quot; to add PNG, JPEG, or PDF files
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-200 rounded-lg bg-white gap-4"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="text-gray-400 flex-shrink-0">
                  {getFileIcon(doc.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">
                    {doc.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    Uploaded on {formatUploadDate(doc.uploadDate)} • {doc.size}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(doc)}
                  className="w-full sm:w-auto"
                >
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="w-full sm:w-auto"
                  title="Download file"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-500 w-full sm:w-auto"
                  onClick={() => onDelete(doc.id)}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
