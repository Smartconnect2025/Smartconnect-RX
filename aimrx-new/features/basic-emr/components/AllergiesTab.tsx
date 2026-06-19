"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useUser } from "@core/auth";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  ShieldAlert,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

import { allergyService } from "../services/allergyService";
import { Allergy } from "../types";
import { AllergyModal } from "./AllergyModal";

interface AllergiesTabProps {
  patientId: string;
  patientName?: string;
}

const SEVERITY_CONFIG: Record<
  string,
  { dot: string; bg: string; text: string; label: string }
> = {
  mild: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Mild" },
  moderate: { dot: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700", label: "Moderate" },
  severe: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Severe" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const key = (severity || "mild").toLowerCase();
  const config = SEVERITY_CONFIG[key] || SEVERITY_CONFIG.mild;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      data-testid={`severity-badge-${key}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export function AllergiesTab({ patientId, patientName = "" }: AllergiesTabProps) {
  const { user } = useUser();
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [allergyToDelete, setAllergyToDelete] = useState<Allergy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchAllergies = useCallback(async () => {
    if (!user?.id) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setFetchError(null);
    try {
      const result = await allergyService.getAllergies(patientId, user.id);
      if (result.success && result.data) {
        setAllergies(result.data);
      } else if (result.error) {
        console.error("Error fetching allergies:", result.error);
        setFetchError("Failed to load allergies");
        setAllergies([]);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [patientId, user?.id]);

  useEffect(() => {
    fetchAllergies();
  }, [fetchAllergies]);

  const filteredAllergies = useMemo(() => {
    if (!searchTerm) return allergies;
    const q = searchTerm.toLowerCase();
    return allergies.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.reactionType?.toLowerCase().includes(q) ||
        a.severity?.toLowerCase().includes(q),
    );
  }, [allergies, searchTerm]);

  const severeCount = useMemo(
    () => allergies.filter((a) => a.severity?.toLowerCase() === "severe").length,
    [allergies],
  );

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleAdd = () => {
    setEditingAllergy(null);
    setIsModalOpen(true);
  };

  const handleEdit = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    fetchAllergies();
  };

  const handleConfirmDelete = async () => {
    if (!allergyToDelete || !user?.id) return;
    setIsDeleting(true);
    try {
      const result = await allergyService.deleteAllergy(
        allergyToDelete.id,
        user.id,
      );
      if (result.success) {
        toast.success("Allergy deleted successfully");
        setAllergies((prev) => prev.filter((a) => a.id !== allergyToDelete.id));
        setAllergyToDelete(null);
      } else {
        toast.error(result.error || "Failed to delete allergy");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete allergy",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const renderEmptyState = () => (
    <Card
      className="border border-dashed border-gray-200 shadow-none"
      data-testid="empty-state-allergies"
    >
      <CardContent className="py-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <ShieldAlert className="h-7 w-7 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">
          No Allergies Recorded
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
          Add known allergies to keep this patient&rsquo;s chart complete and
          safe.
        </p>
        <Button
          onClick={handleAdd}
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-testid="button-add-allergy-empty"
        >
          <Plus className="h-4 w-4" />
          Add Allergy
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4" data-testid="allergies-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Allergies</h3>
            <p className="text-xs text-muted-foreground">
              {allergies.length} recorded
              {severeCount > 0 ? ` · ${severeCount} severe` : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={handleAdd}
          variant="default"
          size="sm"
          className="gap-1.5 self-start sm:self-auto"
          data-testid="button-add-allergy"
        >
          <Plus className="h-4 w-4" />
          Add Allergy
        </Button>
      </div>

      {/* Search */}
      {allergies.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search allergies..."
            className="pl-9"
            data-testid="input-search-allergies"
          />
        </div>
      )}

      {fetchError && (
        <div
          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          data-testid="allergies-error"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : allergies.length === 0 ? (
        renderEmptyState()
      ) : filteredAllergies.length === 0 ? (
        <Card className="border border-dashed border-gray-200 shadow-none">
          <CardContent className="py-8 text-center">
            <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-muted-foreground">
              No allergies match &ldquo;{searchTerm}&rdquo;
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm" data-testid="card-allergies">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/40">
                    <TableHead className="text-xs font-semibold">
                      Allergen
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Reaction
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Severity
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Date Added
                    </TableHead>
                    <TableHead className="text-xs font-semibold w-24 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAllergies.map((allergy, idx) => (
                    <TableRow
                      key={allergy.id}
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-red-50/30 transition-colors`}
                      data-testid={`row-allergy-${allergy.id}`}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          {allergy.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {allergy.reactionType}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={allergy.severity} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {formatDate(allergy.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(allergy)}
                            className="h-7 w-7 p-0 hover:bg-blue-50"
                            data-testid={`button-edit-allergy-${allergy.id}`}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAllergyToDelete(allergy)}
                            className="h-7 w-7 p-0 hover:bg-red-50"
                            data-testid={`button-delete-allergy-${allergy.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AllergyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientId={patientId}
        patientName={patientName}
        allergy={editingAllergy}
        onSuccess={handleModalSuccess}
      />

      <AlertDialog
        open={!!allergyToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setAllergyToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete allergy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold">{allergyToDelete?.name}</span> from{" "}
              {patientName || "this patient"}&rsquo;s chart. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
