"use client";

import { Download, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentType {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  url: string;
  file?: File;
}

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentType | null;
}

export function DocumentViewer({
  isOpen,
  onClose,
  document,
}: DocumentViewerProps) {
  const [imageZoom, setImageZoom] = useState(100);
  const [imageRotation, setImageRotation] = useState(0);

  const handleZoomIn = () => {
    setImageZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setImageZoom((prev) => Math.max(prev - 25, 25));
  };

  const handleRotate = () => {
    setImageRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = () => {
    if (!document) return;

    const link = window.document.createElement("a");
    link.href = document.url;
    link.download = document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    toast.success("Download started");
  };

  const handleClose = () => {
    setImageZoom(100);
    setImageRotation(0);
    onClose();
  };

  const formatUploadDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] p-0 bg-white">
        <DialogHeader className="p-6 pb-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {document?.name}
            </DialogTitle>
            <div className="flex items-center space-x-2 pr-4">
              {document?.type === "image" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={imageZoom <= 25}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600 min-w-[60px] text-center">
                    {imageZoom}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={imageZoom >= 300}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRotate}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 bg-white">
          {document && (
            <>
              {document.type === "pdf" && (
                <div className="w-full h-[70vh] bg-white flex flex-col items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center">
                      <svg className="h-10 w-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{document.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">PDF Document</p>
                    </div>
                    <Button
                      onClick={() => window.open(document.url, '_blank')}
                      className="mt-4"
                    >
                      Open PDF in New Tab
                    </Button>
                  </div>
                </div>
              )}

              {document.type === "image" && (
                <div className="flex justify-center items-center min-h-[60vh] bg-gray-50 rounded-lg overflow-auto">
                  <div className="inline-block min-w-min">
                    <img
                      src={document.url}
                      alt={document.name}
                      className="transition-transform duration-200"
                      style={{
                        transform: `scale(${
                          imageZoom / 100
                        }) rotate(${imageRotation}deg)`,
                        transformOrigin: "center",
                        imageRendering: "crisp-edges",
                        maxWidth: "none",
                        height: "auto",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t bg-white text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>
              Uploaded on {document && formatUploadDate(document.uploadDate)}
            </span>
            <span>{document?.size}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
