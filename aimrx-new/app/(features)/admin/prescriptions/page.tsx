"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, User, Calendar, Pill, Hash, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { PrescriptionProgressTracker } from "@/app/(features)/prescriptions/_components/PrescriptionProgressTracker";

interface AdminPrescription {
  id: string;
  queueId: string;
  submittedAt: string;
  providerName: string;
  patientName: string;
  medication: string;
  strength: string;
  quantity: number;
  refills: number;
  sig: string;
  status: string;
  trackingNumber?: string;
  pharmacyName?: string;
  pharmacyColor?: string;
  billingStatus?: string;
  patientCopay?: string;
  deliveryDate?: string;
  lotNumber?: string;
}

const STATUS_OPTIONS = [
  "All",
  "submitted",
  "pending_payment",
  "payment_received",
  "packed",
  "approved",
  "picked_up",
  "shipped",
  "delivered",
];

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "pending_payment":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "payment_received":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "packed":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "picked_up":
    case "shipped":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatDateTime = (dateTime: string) => {
  const date = new Date(dateTime);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<AdminPrescription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedPrescription, setSelectedPrescription] = useState<AdminPrescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await fetch("/api/admin/prescriptions");
      const data = await response.json();

      if (!response.ok) {
        console.error("Error loading prescriptions:", data.error);
        setLoadError(data.error || "Failed to load prescriptions");
        return;
      }

      setPrescriptions(data.prescriptions || []);
    } catch (error) {
      console.error("Error loading prescriptions:", error);
      setLoadError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrescriptions();

    const interval = setInterval(loadPrescriptions, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [loadPrescriptions]);

  const filteredPrescriptions = prescriptions.filter((prescription) => {
    const matchesSearch =
      prescription.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.medication.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.queueId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || prescription.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getStatusCount = (status: string) => {
    if (status === "All") return prescriptions.length;
    return prescriptions.filter((p) => p.status.toLowerCase() === status.toLowerCase()).length;
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Incoming Prescriptions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Click any row to view full details and order progress
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, provider, medication, or Queue ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        <div className="w-64 flex-shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "All" ? status : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")} ({getStatusCount(status)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground" data-testid="text-results-count">
          Showing {filteredPrescriptions.length} of {prescriptions.length} prescriptions
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold w-[140px]">Date</TableHead>
                <TableHead className="font-semibold">Provider</TableHead>
                <TableHead className="font-semibold">Patient</TableHead>
                <TableHead className="font-semibold">Medication</TableHead>
                <TableHead className="font-semibold w-[100px]">Qty/Refills</TableHead>
                <TableHead className="font-semibold">Pharmacy</TableHead>
                <TableHead className="font-semibold">SIG</TableHead>
                <TableHead className="font-semibold w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading prescriptions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : loadError ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm font-medium">{loadError}</p>
                      <button onClick={loadPrescriptions} className="text-xs text-blue-600 hover:underline mt-1">
                        Try again
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredPrescriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No prescriptions found matching your filters
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPrescriptions.map((prescription, idx) => (
                  <TableRow
                    key={prescription.id}
                    className={`cursor-pointer transition-colors hover:bg-blue-50/50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                    onClick={() => setSelectedPrescription(prescription)}
                    data-testid={`row-prescription-${prescription.id}`}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(prescription.submittedAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {prescription.providerName}
                    </TableCell>
                    <TableCell className="font-medium">
                      {prescription.patientName}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex flex-col">
                        <span
                          className="font-medium truncate"
                          title={prescription.medication}
                        >
                          {prescription.medication}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          {prescription.strength}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>Qty: {prescription.quantity}</span>
                        <span className="text-muted-foreground">
                          Ref: {prescription.refills}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {prescription.pharmacyName ? (
                        <span className="font-medium text-sm" style={{ color: prescription.pharmacyColor || "#1E3A8A" }}>
                          {prescription.pharmacyName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not specified</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p
                        className="text-sm truncate cursor-help"
                        title={prescription.sig}
                      >
                        {prescription.sig}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(prescription.status)} text-xs px-2 py-1`}
                      >
                        {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selectedPrescription} onOpenChange={(open) => !open && setSelectedPrescription(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-prescription-detail">
          {selectedPrescription && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-xl font-bold text-[#1E3A8A]">
                    Prescription Details
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(selectedPrescription.status)} text-xs px-2.5 py-1`}
                  >
                    {selectedPrescription.status.charAt(0).toUpperCase() + selectedPrescription.status.slice(1).replace(/_/g, " ")}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Queue ID</p>
                      <p className="text-sm font-mono font-semibold" data-testid="text-queue-id">{selectedPrescription.queueId}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Submitted</p>
                      <p className="text-sm font-semibold" data-testid="text-submitted-date">{formatDateTime(selectedPrescription.submittedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Provider</p>
                      <p className="text-sm font-semibold" data-testid="text-provider-name">{selectedPrescription.providerName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Patient</p>
                      <p className="text-sm font-semibold" data-testid="text-patient-name">{selectedPrescription.patientName}</p>
                    </div>
                  </div>
                </div>

                <PrescriptionProgressTracker
                  status={selectedPrescription.status}
                  trackingNumber={selectedPrescription.trackingNumber}
                  pharmacyName={selectedPrescription.pharmacyName}
                  billingStatus={selectedPrescription.billingStatus}
                  patientCopay={selectedPrescription.patientCopay}
                />

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-[#1E3A8A]" />
                    Medication Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Medication</p>
                      <p className="text-sm font-medium" data-testid="text-medication">{selectedPrescription.medication}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Strength</p>
                      <p className="text-sm font-medium" data-testid="text-strength">{selectedPrescription.strength || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-sm font-medium" data-testid="text-quantity">{selectedPrescription.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Refills</p>
                      <p className="text-sm font-medium" data-testid="text-refills">{selectedPrescription.refills}</p>
                    </div>
                  </div>
                  {selectedPrescription.sig && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        SIG Instructions
                      </p>
                      <p className="text-sm font-medium mt-0.5" data-testid="text-sig">{selectedPrescription.sig}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
