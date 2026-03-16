"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@core/auth";
import { ArrowLeft } from "lucide-react";

import { useDocumentManager } from "../hooks/useDocumentManager";
import { useEmrStore } from "../store/emr-store";
import { Patient } from "../types";

import { DocumentManager } from "./DocumentManager";
import { DocumentViewer } from "./DocumentViewer";
import { MedicationsTab } from "./MedicationsTab";

import { PatientSidebar } from "./PatientSidebar";
import { toast } from "sonner";

interface PatientChartProps {
  patientId: string;
}

interface DocumentType {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  url: string;
  file?: File;
}

export function PatientChart({ patientId }: PatientChartProps) {
  const router = useRouter();
  const { user } = useUser();

  const patients = useEmrStore((state) => state.patients);
  const currentPatient = useEmrStore((state) => state.currentPatient);
  const loading = useEmrStore((state) => state.loading);
  const error = useEmrStore((state) => state.error);
  const fetchPatientById = useEmrStore((state) => state.fetchPatientById);
  const setCurrentPatient = useEmrStore((state) => state.setCurrentPatient);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<DocumentType | null>(
    null,
  );

  const { documents, handleUpload, handleDelete, handleView } =
    useDocumentManager(patientId);

  const loadPatientData = useCallback(async () => {
    if (!user?.id) return;

    await fetchPatientById(patientId, user.id);
  }, [
    user?.id,
    patientId,
    fetchPatientById,
  ]);

  useEffect(() => {
    if (user?.id) {
      loadPatientData();
    }
  }, [loadPatientData, user?.id]);

  useEffect(() => {
    if (currentPatient && currentPatient.id === patientId) {
      setPatient(currentPatient);
    } else {
      const foundPatient = patients.find((p: Patient) => p.id === patientId);
      if (foundPatient) {
        setPatient(foundPatient);
        setCurrentPatient(foundPatient);
      }
    }
  }, [currentPatient, patients, patientId, setCurrentPatient]);

  const handleEditPatient = () => {
    router.push(`/basic-emr/patients/${patientId}/edit`);
  };

  const handleViewDocument = (doc: DocumentType) => {
    if (handleView(doc)) {
      setCurrentDocument(doc);
      setIsDocumentViewerOpen(true);
    }
  };

  const handleCloseDocumentViewer = () => {
    setIsDocumentViewerOpen(false);
    setCurrentDocument(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Please log in to view patient chart
          </h2>
          <Button
            onClick={() => router.push("/auth")}
            variant="default"
            className="px-6 py-2 rounded-lg"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Loading patient chart...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    toast.error(error);
    // return (
    //   <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    //     <div className="text-center">
    //       <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
    //       <p className="text-gray-600 mb-4">{error}</p>
    //       <Button onClick={() => router.back()} variant="outline">
    //         Go Back
    //       </Button>
    //     </div>
    //   </div>
    // );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Patient not found
          </h2>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      <PatientSidebar
        patient={patient}
        onEditPatient={handleEditPatient}
      />

      <main className="flex-1 flex flex-col">
        {/* Back Button Header - Hidden on small screens */}
        <div className="bg-white border-b border-gray-200 px-4 py-6 hidden sm:block">
          <Button
            variant="ghost"
            onClick={() => router.push("/basic-emr")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Patients
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white p-4 sm:p-6 lg:p-8">

          <Tabs defaultValue="medications" className="w-full">
            <div className="mb-4">
              <div className="overflow-x-auto">
                <TabsList className="bg-gray-100 flex-nowrap w-max min-w-full">
                  <TabsTrigger
                    value="medications"
                    className="data-[state=active]:bg-white whitespace-nowrap flex-shrink-0 px-3 py-2 text-sm"
                  >
                    Medications
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className="data-[state=active]:bg-white whitespace-nowrap flex-shrink-0 px-3 py-2 text-sm"
                  >
                    <span className="hidden sm:inline">Documents</span>
                    <span className="sm:hidden">Docs</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="medications" className="space-y-6">
              <MedicationsTab
                patientId={patientId}
                patientName={patient ? `${patient.firstName} ${patient.lastName}` : ""}
              />
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <DocumentManager
                documents={documents}
                onUpload={handleUpload}
                onView={handleViewDocument}
                onDelete={handleDelete}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={handleCloseDocumentViewer}
        document={currentDocument}
      />
    </div>
  );
}
