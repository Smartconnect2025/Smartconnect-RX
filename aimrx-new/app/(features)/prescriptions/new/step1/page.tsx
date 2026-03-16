"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser } from "@core/auth";
import { Search, UserPlus, ArrowRight, User, X } from "lucide-react";
import { useEmrStore } from "@/features/basic-emr/store/emr-store";
import { ITEMS_PER_PAGE } from "@/features/basic-emr/constants";
import { createClient } from "@core/supabase";
import { PrescriptionPdfUpload } from "@/components/prescriptions/PrescriptionPdfUpload";
import { clearPrescriptionSession } from "../prescriptionSessionUtils";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
}

export default function PrescriptionStep1Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const supabase = createClient();
  const patients = useEmrStore((state) => state.patients);
  const loading = useEmrStore((state) => state.loading);
  const error = useEmrStore((state) => state.error);
  const fetchPatients = useEmrStore((state) => state.fetchPatients);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [prescriptionPdf, setPrescriptionPdf] = useState<File | null>(null);

  // Check if coming from encounter (patient already selected)
  const encounterId = searchParams.get("encounterId");
  const appointmentId = searchParams.get("appointmentId");
  const preselectedPatientId = searchParams.get("patientId");

  // Clear all prescription wizard state on mount (ensures fresh start)
  useEffect(() => {
    const preserveEncounter = !!(preselectedPatientId && encounterId);
    clearPrescriptionSession({
      preserveEncounterContext: preserveEncounter,
    });
  }, [preselectedPatientId, encounterId]);

  useEffect(() => {
    // If patient is already selected (coming from encounter), skip to step 2
    if (preselectedPatientId && encounterId) {
      sessionStorage.setItem("encounterId", encounterId);
      if (appointmentId) {
        sessionStorage.setItem("appointmentId", appointmentId);
      }
      router.replace(
        `/prescriptions/new/step2?patientId=${preselectedPatientId}`,
      );
      return;
    }

    if (user?.id) {
      fetchPatients(user.id, searchQuery, currentPage, ITEMS_PER_PAGE);
    }
  }, [
    user?.id,
    searchQuery,
    currentPage,
    fetchPatients,
    preselectedPatientId,
    encounterId,
    appointmentId,
    router,
  ]);

  // Set up real-time subscription for patient changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("patients-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
        },
        () => {
          // Reload patients when any change occurs
          fetchPatients(user.id, searchQuery, currentPage, ITEMS_PER_PAGE);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.id, fetchPatients, searchQuery, currentPage]);

  // Clean up prescription state when unmounting (navigating away)
  useEffect(() => {
    return () => {
      if (!window.location.pathname.startsWith("/prescriptions/new/")) {
        clearPrescriptionSession();
      }
    };
  }, []);

  if (!user) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Please log in to create prescriptions
            </h2>
            <Button onClick={() => router.push("/auth")}>Go to Login</Button>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleSelectPatient = (patient: Patient) => {
    // Store selected patient - don't navigate yet, wait for PDF upload
    setSelectedPatient(patient);
    setPrescriptionPdf(null); // Reset PDF when changing patient
  };

  const handleClearSelection = () => {
    setSelectedPatient(null);
    setPrescriptionPdf(null);
  };

  const handleContinueToStep2 = () => {
    if (!selectedPatient) {
      return;
    }

    if (prescriptionPdf) {
      // Convert PDF to data URL and store in sessionStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;

        sessionStorage.setItem("prescriptionPdfData", dataUrl);
        sessionStorage.setItem("prescriptionPdfName", prescriptionPdf.name);

        router.push(`/prescriptions/new/step2?patientId=${selectedPatient.id}`);
      };
      reader.onerror = (error) => {
        console.error("📄 [Step1] Error reading PDF file:", error);
      };
      reader.readAsDataURL(prescriptionPdf);
    } else {
      // No PDF uploaded, clear any previous PDF data and continue
      sessionStorage.removeItem("prescriptionPdfData");
      sessionStorage.removeItem("prescriptionPdfName");
      router.push(`/prescriptions/new/step2?patientId=${selectedPatient.id}`);
    }
  };

  const handleCreatePatient = () => {
    router.push("/basic-emr/patients/new");
  };

  const handleCancel = () => {
    router.push("/prescriptions");
  };

  return (
    <DefaultLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                New Prescription
              </h1>
              <p className="text-muted-foreground mt-2">
                Step 1 of 3: Select Patient
              </p>
            </div>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mt-6">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                1
              </div>
              <span className="ml-2 font-medium">Select Patient</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                2
              </div>
              <span className="ml-2 text-muted-foreground">
                Prescription Details
              </span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                3
              </div>
              <span className="ml-2 text-muted-foreground">
                Review & Submit
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white border border-border rounded-lg p-6">
          {/* Search */}
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Add New Patient Button - Right Aligned */}
          <div className="flex justify-end mb-6">
            <Button onClick={handleCreatePatient} variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Patient
            </Button>
          </div>

          {/* Patient List */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading patients...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No patients found matching your search"
                  : "No patients found. Add your first patient to get started."}
              </p>
              <Button onClick={handleCreatePatient} variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Patient
              </Button>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-none">
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Name
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Date of Birth
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Email
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Phone
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient, index) => (
                    <TableRow
                      key={patient.id}
                      className={`border-none min-h-[60px] ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                      style={{ minHeight: "60px" }}
                    >
                      <TableCell className="px-4 sm:px-6 py-4 text-gray-900 font-medium border-none">
                        {patient.firstName} {patient.lastName}
                      </TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                        {patient.dateOfBirth
                          ? new Date(patient.dateOfBirth).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                        {patient.email || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                        {patient.phone || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 border-none text-right">
                        <Button
                          onClick={() => handleSelectPatient(patient)}
                          size="sm"
                          variant={
                            selectedPatient?.id === patient.id
                              ? "default"
                              : "outline"
                          }
                        >
                          {selectedPatient?.id === patient.id
                            ? "Selected"
                            : "Select"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Selected Patient & PDF Upload Section */}
        {selectedPatient && (
          <div className="mt-6 bg-white border border-border rounded-lg p-6 space-y-6">
            {/* Selected Patient Card */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Selected Patient</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedPatient.dateOfBirth
                      ? new Date(
                          selectedPatient.dateOfBirth,
                        ).toLocaleDateString()
                      : ""}{" "}
                    {selectedPatient.email && `• ${selectedPatient.email}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4 mr-1" />
                Change
              </Button>
            </div>

            {/* PDF Upload Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A8A]">
                  Prescription Document (optional)
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Upload the signed prescription PDF document.
                </p>
              </div>
              <PrescriptionPdfUpload
                onFileSelect={(file) => setPrescriptionPdf(file)}
                onRemove={() => setPrescriptionPdf(null)}
                selectedFile={prescriptionPdf}
              />
            </div>

            {/* Continue Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleContinueToStep2}
                size="lg"
              >
                Continue to Prescription Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DefaultLayout>
  );
}
