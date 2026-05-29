"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PatientForm } from "@/features/basic-emr/components/PatientForm";
import { useEmrStore } from "@/features/basic-emr/store/emr-store";
import { Patient } from "@/features/basic-emr/types";
import { useUser } from "@core/auth";

interface EditPatientPageProps {
  params: Promise<{ id: string }>;
}

export default function EditPatientPage({ params }: EditPatientPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const [patientId, setPatientId] = useState<string>("");
  const [patient, setPatient] = useState<Patient | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const currentPatient = useEmrStore((state) => state.currentPatient);
  const patients = useEmrStore((state) => state.patients);
  const fetchPatientById = useEmrStore((state) => state.fetchPatientById);
  const loading = useEmrStore((state) => state.loading);
  const error = useEmrStore((state) => state.error);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }

    params.then(async ({ id }) => {
      setPatientId(id);

      // First, check if patient is already in the store
      const foundPatient =
        patients.find((p) => p.id === id) ||
        (currentPatient?.id === id ? currentPatient : null);

      if (foundPatient) {
        setPatient(foundPatient);
        setIsLoading(false);
      } else {
        // Fetch patient from backend if not in store
        try {
          const fetchedPatient = await fetchPatientById(id, user.id);
          if (fetchedPatient) {
            setPatient(fetchedPatient);
          }
        } catch (error) {
          console.error("Error fetching patient:", error);
        } finally {
          setIsLoading(false);
        }
      }
    });
  }, [params, patients, currentPatient, fetchPatientById, user, router]);

  // Handle unauthenticated user
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Please log in to edit patient
          </h2>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Loading patient...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/basic-emr")}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg"
          >
            Back to Patient List
          </button>
        </div>
      </div>
    );
  }

  // Patient not found
  if (!patient) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Patient not found
          </h2>
          <p className="text-gray-600 mb-4">
            The patient with ID {patientId} could not be found.
          </p>
          <button
            onClick={() => router.push("/basic-emr")}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg"
          >
            Back to Patient List
          </button>
        </div>
      </div>
    );
  }

  return <PatientForm patient={patient} isEditing={true} />;
}
