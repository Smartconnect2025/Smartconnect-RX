"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import {
  Calendar,
  Phone,
  Mail,
  MapPin,
  Eye,
  Trash2,
  Search,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BaseTableManagement } from "./BaseTableManagement";
import { getOptimizedAvatarUrl } from "@core/services/storage/avatarStorage";
import { useUser } from "@core/auth";
import { createClient } from "@/core/supabase/client";

import type { Patient } from "../types";
import { PatientDetailView } from "./PatientDetailView";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

export const PatientsManagement: React.FC = () => {
  const { guardAction } = useDemoGuard();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scopeChecked, setScopeChecked] = useState(false);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [pharmacies, setPharmacies] = useState<{ id: string; name: string }[]>([]);

  const fetchPharmacies = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPharmacies(data || []);
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  };

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (pharmacyFilter && pharmacyFilter !== "all") {
        params.set("pharmacyId", pharmacyFilter);
      }
      const url = `/api/admin/patients${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPatients(data.patients || []);
      } else {
        toast.error("Failed to fetch patients");
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast.error("Failed to fetch patients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkScope = async () => {
      if (!user?.id) return;
      const supabase = createClient();

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleRow?.role === "super_admin") {
        setIsSuperAdmin(true);
      }
      setScopeChecked(true);
    };
    checkScope();
  }, [user?.id]);

  useEffect(() => {
    if (!scopeChecked) return;
    if (isSuperAdmin) {
      fetchPharmacies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecked, isSuperAdmin]);

  useEffect(() => {
    if (!scopeChecked) return;
    fetchPatients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecked, pharmacyFilter]);

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || patient.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 border border-border"
          >
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge
            variant="secondary"
            className="bg-gray-100 text-gray-800 border border-border"
          >
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderTableHeaders = () => (
    <>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Patient
      </th>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Contact
      </th>
      {isSuperAdmin && (
        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
          Pharmacy
        </th>
      )}
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Location
      </th>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Date of Birth
      </th>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Status
      </th>
      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
        Actions
      </th>
    </>
  );

  const renderTableRow = (patient: Patient) => (
    <>
      <td className="p-4 align-middle">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={
                patient.avatar_url
                  ? getOptimizedAvatarUrl(patient.avatar_url, 40)
                  : ""
              }
              alt={`${patient.first_name} ${patient.last_name}`}
            />
            <AvatarFallback className="text-sm">
              {patient.first_name && patient.last_name
                ? `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()
                : "P"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="font-medium">
              {patient.first_name || ""} {patient.last_name || ""}
            </div>
            <div className="text-sm text-muted-foreground flex items-center">
              <Mail className="h-3 w-3 mr-1" />
              {patient.email || ""}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4 align-middle">
        {patient.phone_number ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Phone className="h-3 w-3 mr-1" />
            {patient.phone_number || ""}
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      {isSuperAdmin && (
        <td className="p-4 align-middle">
          {patient.pharmacy_name ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {patient.pharmacy_name}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">Not assigned</span>
          )}
        </td>
      )}
      <td className="p-4 align-middle">
        {patient.city && patient.state ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-3 w-3 mr-1" />
            {patient.city || ""}, {patient.state || ""}
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="p-4 align-middle">
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-3 w-3 mr-1" />
          {new Date(patient.date_of_birth).toLocaleDateString() || ""}
        </div>
      </td>
      <td className="p-4 align-middle">{getStatusBadge(patient.status)}</td>
      <td className="p-4 align-middle text-right">
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedPatient(patient)}
            className="border border-border"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeletingPatient(patient)}
            className="border border-border"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </>
  );

  const handleDelete = async () => {
    if (!deletingPatient) return;
    guardAction(async () => {
    try {
      const response = await fetch(
        `/api/admin/patients/${deletingPatient.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_active: false }),
        },
      );

      if (response.ok) {
        toast.success("Patient deactivated successfully");
        setDeletingPatient(null);
        fetchPatients();
      } else {
        toast.error("Failed to deactivate patient");
      }
    } catch (error) {
      console.error("Error deactivating patient:", error);
      toast.error("Failed to deactivate patient");
    }
    });
  };

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Patient Management
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <Input
              placeholder="Search patients by name, email..."
              className="pl-12 h-11 rounded-lg border-gray-200 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchPatients()}
            className="h-11 w-11 border-gray-200 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isSuperAdmin && (
          <div className="mb-1">
            <div className="space-y-1.5">
              <Label htmlFor="pharmacy-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger id="pharmacy-filter" className="w-[280px] h-10 bg-white border-gray-200">
                  <SelectValue placeholder="All Pharmacies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <BaseTableManagement
        data={filteredPatients}
        isLoading={isLoading}
        renderTableHeaders={renderTableHeaders}
        renderTableRow={renderTableRow}
        getItemKey={(patient) => patient.id}
        emptyStateMessage="No patients found"
      />

      {/* Dialogs */}
      <Dialog
        open={!!selectedPatient}
        onOpenChange={() => setSelectedPatient(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-transparent border-none">
          {selectedPatient && (
            <PatientDetailView
              patient={selectedPatient}
              onClose={() => setSelectedPatient(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingPatient}
        onOpenChange={() => setDeletingPatient(null)}
      >
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &ldquo;
              {deletingPatient?.first_name} {deletingPatient?.last_name}&rdquo;?
              This will set their status to inactive but won&apos;t delete their
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
