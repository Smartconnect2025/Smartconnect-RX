import { useState, useEffect } from "react";
import { toast } from "sonner";

interface DocumentType {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  url: string;
  file?: File; // Store the actual file object for viewing
}

interface PatientDocument {
  id: string;
  name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  file_url: string;
  storage_path: string;
  uploaded_at: string;
}

export function useDocumentManager(patientId?: string) {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Convert database document to DocumentType
  const convertToDocumentType = (doc: PatientDocument): DocumentType => ({
    id: doc.id,
    name: doc.name,
    type: doc.file_type,
    uploadDate: new Date(doc.uploaded_at).toISOString().split("T")[0],
    size: formatFileSize(doc.file_size),
    url: doc.file_url,
  });

  // Fetch documents from database
  const fetchDocuments = async () => {
    if (!patientId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/patients/${patientId}/documents`);
      const result = await response.json();

      if (result.success && result.documents) {
        const convertedDocs = result.documents.map(convertToDocumentType);
        setDocuments(convertedDocs);
      } else {
        toast.error(result.error || "Failed to load documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  // Load documents on mount and when patientId changes
  useEffect(() => {
    if (patientId) {
      fetchDocuments();
    }
  }, [patientId]);

  const handleUpload = async (files: File[]) => {
    if (!patientId) {
      toast.error("Patient ID is required to upload documents");
      return;
    }

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/patients/${patientId}/documents`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.success && result.document) {
          const newDoc = convertToDocumentType(result.document);
          setDocuments((prev) => [newDoc, ...prev]);
          toast.success(`${file.name} uploaded successfully!`);
        } else {
          toast.error(result.error || `Failed to upload ${file.name}`);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleDelete = async (docId: string) => {
    if (!patientId) {
      toast.error("Patient ID is required to delete documents");
      return;
    }

    try {
      const response = await fetch(
        `/api/patients/${patientId}/documents?id=${docId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
        toast.success("Document deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleView = (_doc: DocumentType) => {
    // All uploaded documents should be viewable
    return true;
  };

  return {
    documents,
    loading,
    handleUpload,
    handleDelete,
    handleView,
    refreshDocuments: fetchDocuments,
  };
}
