"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@core/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pill } from "lucide-react";

interface Prescription {
  id: string;
  patient_id: string;
  medication: string;
  dosage: string;
  quantity: number;
  status: string;
  queue_id: string | null;
  submitted_at: string;
  // Join with patients table for patient name
  patients?: {
    first_name: string;
    last_name: string;
  };
}

interface PatientPrescriptionsTabProps {
  patientId: string;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "billing":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "packed":
      return "bg-purple-100 text-purple-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function PatientPrescriptionsTab({
  patientId,
}: PatientPrescriptionsTabProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("prescriptions")
        .select(
          `
          id,
          patient_id,
          medication,
          dosage,
          quantity,
          status,
          queue_id,
          submitted_at,
          patients (
            first_name,
            last_name
          )
        `,
        )
        .eq("patient_id", patientId)
        .order("submitted_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Transform the data to match our interface
      const transformedData = (data || []).map(
        (item: {
          patients: unknown;
          [key: string]: unknown;
        }) => ({
          ...item,
          patients: Array.isArray(item.patients)
            ? item.patients[0]
            : item.patients,
        }),
      ) as Prescription[];

      setPrescriptions(transformedData);
    } catch (err) {
      console.error("Error loading prescriptions:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load prescriptions. The table may not exist yet.",
      );
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading prescriptions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">{error}</p>
        <p className="text-sm text-muted-foreground">
          The prescriptions table will be created when you connect your own
          Supabase database.
        </p>
      </div>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <Pill className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          No prescriptions submitted yet
        </h3>
        <p className="text-muted-foreground">
          Prescriptions submitted for this patient will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Prescription History ({prescriptions.length})
        </h3>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient Name</TableHead>
              <TableHead>Medication</TableHead>
              <TableHead>Dosage</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Queue ID</TableHead>
              <TableHead>Date Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prescriptions.map((prescription) => (
              <TableRow key={prescription.id}>
                <TableCell className="font-medium">
                  {prescription.patients
                    ? `${prescription.patients.first_name} ${prescription.patients.last_name}`
                    : "Unknown Patient"}
                </TableCell>
                <TableCell>{prescription.medication}</TableCell>
                <TableCell>{prescription.dosage}</TableCell>
                <TableCell>{prescription.quantity}</TableCell>
                <TableCell>
                  <Badge
                    className={getStatusColor(prescription.status)}
                    variant="secondary"
                  >
                    {prescription.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {prescription.queue_id ? (
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {prescription.queue_id}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(prescription.submitted_at).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
