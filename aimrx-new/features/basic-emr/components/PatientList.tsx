"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser } from "@core/auth";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@core/supabase/client";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import { ITEMS_PER_PAGE } from "../constants";
import { useEmrStore } from "../store/emr-store";

// Avatar component for patient initials
function PatientAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="w-10 h-10 rounded-full bg-[#F97316] flex items-center justify-center">
      <span className="text-white font-bold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
        {initials}
      </span>
    </div>
  );
}

export function PatientList() {
  const router = useRouter();
  const { user } = useUser();
  const patients = useEmrStore((state) => state.patients);
  const loading = useEmrStore((state) => state.loading);
  const error = useEmrStore((state) => state.error);
  const fetchPatients = useEmrStore((state) => state.fetchPatients);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [patientPrescriptions, setPatientPrescriptions] = useState<Record<string, number>>({});
  const [, setPatientsWithCards] = useState<Record<string, boolean>>({});
  const [deletingPatient, setDeletingPatient] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchPatients(user.id, searchQuery, currentPage, ITEMS_PER_PAGE);
    }
  }, [user?.id, searchQuery, currentPage, fetchPatients]);

  // Fetch prescription counts for all patients to determine active status
  useEffect(() => {
    async function fetchPrescriptionCounts() {
      if (patients.length === 0) return;

      const supabase = createClient();
      const patientIds = patients.map(p => p.id);
      const { data, error } = await supabase
        .from("prescriptions")
        .select("patient_id")
        .in("patient_id", patientIds);

      if (!error && data) {
        // Count prescriptions per patient
        const counts: Record<string, number> = {};
        data.forEach((prescription: { patient_id: string }) => {
          const patientId = prescription.patient_id;
          counts[patientId] = (counts[patientId] || 0) + 1;
        });
        setPatientPrescriptions(counts);
      }
    }

    fetchPrescriptionCounts();
  }, [patients]);

  // Fetch patients with cards on file
  useEffect(() => {
    async function fetchPatientsWithCards() {
      if (patients.length === 0) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from("patients")
        .select("id, stripe_customer_id")
        .in("id", patients.map(p => p.id))
        .not("stripe_customer_id", "is", null);

      if (!error && data) {
        const cardsMap: Record<string, boolean> = {};
        data.forEach((patient: { id: string; stripe_customer_id: string | null }) => {
          if (patient.stripe_customer_id) {
            cardsMap[patient.id] = true;
          }
        });
        setPatientsWithCards(cardsMap);
      }
    }

    fetchPatientsWithCards();
  }, [patients]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Please log in to view patients
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

  const totalPages = Math.ceil(patients.length / ITEMS_PER_PAGE);
  const currentPatients = patients;

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleViewPatient = (patientId: string) => {
    router.push(`/basic-emr/patients/${patientId}`);
  };

  const handleCreatePatient = () => {
    router.push("/basic-emr/patients/new");
  };

  const handleDeletePatient = (patientId: string, patientName: string) => {
    setDeletingPatient({ id: patientId, name: patientName });
  };

  const confirmDelete = async () => {
    if (!deletingPatient || !user?.id) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", deletingPatient.id);

    if (error) {
      toast.error("Failed to delete patient");
      console.error("Error deleting patient:", error);
    } else {
      toast.success("Patient deleted successfully");
      // Refresh the patients list
      fetchPatients(user.id, searchQuery, currentPage, ITEMS_PER_PAGE);
    }

    setDeletingPatient(null);
  };

  const cancelDelete = () => {
    setDeletingPatient(null);
  };

  const pageNumbers: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar and Create Button */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <Input
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md border-gray-300 rounded-lg"
          />
          <Button
            onClick={handleCreatePatient}
            variant="default"
            size="sm"
            className="border-[#1E3A8A] bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]/90"
          >
            Create New Patient
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading patients...</div>
          </div>
        )}
        {error && (
          <div className="flex justify-center py-4 text-red-500">{error}</div>
        )}

        {!loading && !error && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-none">
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Avatar
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      First Name
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Last Name
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Status
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Gender
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Date of Birth
                    </TableHead>
                    <TableHead className="text-[#1E3A8A] font-bold px-4 sm:px-6 py-4 border-none">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPatients.length === 0 ? (
                    <TableRow className="border-none">
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-gray-500 border-none"
                      >
                        No patients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentPatients.map((patient, index) => {
                      const hasActivePrescriptions = (patientPrescriptions[patient.id] || 0) > 0;

                      return (
                        <TableRow
                          key={patient.id}
                          className={`border-none min-h-[60px] ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                          style={{ minHeight: '60px' }}
                        >
                          <TableCell className="px-4 sm:px-6 py-4 border-none">
                            <PatientAvatar firstName={patient.firstName} lastName={patient.lastName} />
                          </TableCell>
                          <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                            {patient.firstName}
                          </TableCell>
                          <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                            {patient.lastName}
                          </TableCell>
                          <TableCell className="px-4 sm:px-6 py-4 border-none">
                            {hasActivePrescriptions ? (
                              <Badge className="bg-[#1E3A8A] text-white uppercase text-xs font-semibold px-3 py-1 rounded-[4px] hover:bg-[#1E3A8A]">
                                ACTIVE
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                            {patient.gender || "Not specified"}
                          </TableCell>
                          <TableCell className="px-4 sm:px-6 py-4 text-gray-900 border-none">
                            {patient.dateOfBirth}
                          </TableCell>
                          <TableCell className="px-4 sm:px-6 py-4 border-none">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewPatient(patient.id)}
                                className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white"
                              >
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeletePatient(patient.id, `${patient.firstName} ${patient.lastName}`)}
                                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <Pagination>
              <PaginationContent className="flex items-center space-x-1">
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handlePageChange(Math.max(1, currentPage - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-2 sm:px-3 py-2 text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </Button>
                </PaginationItem>
                {pageNumbers.map((page) => (
                  <PaginationItem key={page}>
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={
                        currentPage === page
                          ? "px-2 sm:px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                          : "px-2 sm:px-3 py-2 text-gray-700 border-gray-300 hover:bg-gray-50 text-sm"
                      }
                    >
                      {page}
                    </Button>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-2 sm:px-3 py-2 text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingPatient} onOpenChange={(open) => !open && cancelDelete()}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Patient</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingPatient?.name}? This action cannot be undone and will permanently delete all patient data including prescriptions, encounters, and medical records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
