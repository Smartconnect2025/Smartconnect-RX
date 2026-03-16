"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@core/supabase/client";
import { useUser } from "@core/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pill,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  Activity,
  Calendar,
  Hash,
  FileText,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { medicationService } from "../services/medicationService";
import { Medication, MedicationStatusEnum } from "../types";
import { MedicationModal } from "./MedicationModal";

interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  dosage_amount: string | null;
  dosage_unit: string | null;
  vial_size: string | null;
  form: string | null;
  quantity: number;
  refills: number;
  sig: string;
  status: string;
  submitted_at: string;
  tracking_number: string | null;
  fedex_status: string | null;
  prescriber: {
    first_name: string;
    last_name: string;
  } | null;
}

interface MedicationsTabProps {
  patientId: string;
  patientName?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Pill; dot: string; bg: string; text: string; label: string }> = {
  submitted: { icon: Clock, dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", label: "Submitted" },
  billing: { icon: FileText, dot: "bg-violet-500", bg: "bg-violet-50", text: "text-violet-700", label: "Billing" },
  approved: { icon: CheckCircle2, dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Approved" },
  packed: { icon: Package, dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", label: "Packed" },
  shipped: { icon: Truck, dot: "bg-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700", label: "Shipped" },
  picked_up: { icon: CheckCircle2, dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700", label: "Picked Up" },
  delivered: { icon: CheckCircle2, dot: "bg-green-600", bg: "bg-green-50", text: "text-green-700", label: "Delivered" },
  completed: { icon: CheckCircle2, dot: "bg-green-600", bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  cancelled: { icon: XCircle, dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Cancelled" },
  active: { icon: Activity, dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  discontinued: { icon: XCircle, dot: "bg-gray-500", bg: "bg-gray-100", text: "text-gray-600", label: "Discontinued" },
};

function StatusBadge({ status }: { status: string }) {
  const safeStatus = (status || "unknown").toLowerCase();
  const config = STATUS_CONFIG[safeStatus] || { icon: AlertCircle, dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-700", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`} data-testid={`status-badge-${safeStatus}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function AnimatedCounter({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{display}</>;
}

export function MedicationsTab({ patientId, patientName = "" }: MedicationsTabProps) {
  const { user } = useUser();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [emrMedications, setEmrMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());
  const isFetchingRef = useRef(false);

  const fetchPrescriptions = useCallback(async () => {
    const supabase = supabaseRef.current;
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(`
          id, medication, dosage, dosage_amount, dosage_unit,
          vial_size, form, quantity, refills, sig, status,
          submitted_at, tracking_number, fedex_status, prescriber_id
        `)
        .eq("patient_id", patientId)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching prescriptions:", error);
        setFetchError("Failed to load prescriptions");
        setPrescriptions([]);
        return;
      }

      if (data && data.length > 0) {
        const prescriberIds = [...new Set(data.map(rx => rx.prescriber_id))];
        const { data: providersData } = await supabase
          .from("providers")
          .select("user_id, first_name, last_name")
          .in("user_id", prescriberIds);

        const providersMap = new Map(
          providersData?.map(p => [p.user_id, p]) || []
        );

        setPrescriptions(data.map(rx => ({
          ...rx,
          prescriber: providersMap.get(rx.prescriber_id) || null,
        })));
      } else {
        setPrescriptions([]);
      }
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      setFetchError("Failed to load prescriptions");
      setPrescriptions([]);
    }
  }, [patientId]);

  const fetchEmrMedications = useCallback(async () => {
    if (!user?.id) return;
    const result = await medicationService.getMedications(patientId, user.id);
    if (result.success && result.data) {
      setEmrMedications(result.data);
    } else if (result.error) {
      console.error("Error fetching EMR medications:", result.error);
      setFetchError("Failed to load medications");
    }
  }, [patientId, user?.id]);

  const fetchAll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setFetchError(null);
    try {
      await Promise.all([fetchPrescriptions(), fetchEmrMedications()]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchPrescriptions, fetchEmrMedications]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const currentPrescriptions = useMemo(() =>
    prescriptions.filter(rx => {
      const s = rx.status.toLowerCase();
      return s !== "delivered" && s !== "completed" && s !== "cancelled";
    }),
    [prescriptions]
  );

  const pastPrescriptions = useMemo(() =>
    prescriptions.filter(rx => {
      const s = rx.status.toLowerCase();
      return s === "delivered" || s === "completed" || s === "cancelled";
    }),
    [prescriptions]
  );

  const activeMeds = useMemo(() =>
    emrMedications.filter(m => m.status === MedicationStatusEnum.Active),
    [emrMedications]
  );

  const discontinuedMeds = useMemo(() =>
    emrMedications.filter(m => m.status === MedicationStatusEnum.Discontinued),
    [emrMedications]
  );

  const filteredCurrentPrescriptions = useMemo(() => {
    if (!searchTerm) return currentPrescriptions;
    const q = searchTerm.toLowerCase();
    return currentPrescriptions.filter(rx =>
      rx.medication.toLowerCase().includes(q) ||
      rx.sig?.toLowerCase().includes(q) ||
      rx.prescriber?.first_name?.toLowerCase().includes(q) ||
      rx.prescriber?.last_name?.toLowerCase().includes(q)
    );
  }, [currentPrescriptions, searchTerm]);

  const filteredPastPrescriptions = useMemo(() => {
    if (!searchTerm) return pastPrescriptions;
    const q = searchTerm.toLowerCase();
    return pastPrescriptions.filter(rx =>
      rx.medication.toLowerCase().includes(q) ||
      rx.sig?.toLowerCase().includes(q)
    );
  }, [pastPrescriptions, searchTerm]);

  const filteredActiveMeds = useMemo(() => {
    if (!searchTerm) return activeMeds;
    const q = searchTerm.toLowerCase();
    return activeMeds.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.dosage?.toLowerCase().includes(q) ||
      m.frequency?.toLowerCase().includes(q)
    );
  }, [activeMeds, searchTerm]);

  const filteredDiscontinuedMeds = useMemo(() => {
    if (!searchTerm) return discontinuedMeds;
    const q = searchTerm.toLowerCase();
    return discontinuedMeds.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.dosage?.toLowerCase().includes(q)
    );
  }, [discontinuedMeds, searchTerm]);

  const totalActive = currentPrescriptions.length + activeMeds.length;
  const totalPast = pastPrescriptions.length + discontinuedMeds.length;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });

  const formatDosage = (rx: Prescription) => {
    if (rx.dosage_amount && rx.dosage_unit) return `${rx.dosage_amount}${rx.dosage_unit}`;
    return rx.dosage;
  };

  const formatFormAndVial = (rx: Prescription) => {
    const parts = [];
    if (rx.form) parts.push(rx.form);
    if (rx.vial_size) parts.push(rx.vial_size);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddMedication = () => {
    setEditingMedication(null);
    setIsMedModalOpen(true);
  };

  const handleEditMedication = (med: Medication) => {
    setEditingMedication(med);
    setIsMedModalOpen(true);
  };

  const handleMedModalSuccess = () => {
    fetchEmrMedications();
  };

  const renderKpiCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="medication-kpi-cards">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-blue-50/60" data-testid="card-kpi-active-rx">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Activity className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Active Rx</p>
              <p className="text-xl font-bold text-blue-900">
                <AnimatedCounter value={currentPrescriptions.length} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-emerald-50/60" data-testid="card-kpi-active-meds">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Pill className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Active Meds</p>
              <p className="text-xl font-bold text-emerald-900">
                <AnimatedCounter value={activeMeds.length} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-amber-50/60" data-testid="card-kpi-in-transit">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Truck className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">In Transit</p>
              <p className="text-xl font-bold text-amber-900">
                <AnimatedCounter value={currentPrescriptions.filter(rx => rx.status.toLowerCase() === "shipped").length} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/60" data-testid="card-kpi-completed">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              <p className="text-xl font-bold text-gray-700">
                <AnimatedCounter value={totalPast} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPrescriptionCard = (rx: Prescription) => {
    const isExpanded = expandedRows.has(rx.id);
    const statusConfig = STATUS_CONFIG[rx.status.toLowerCase()] || STATUS_CONFIG["submitted"];
    const StatusIcon = statusConfig.icon;

    return (
      <Card
        key={rx.id}
        className="border shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
        data-testid={`card-prescription-${rx.id}`}
      >
        <CardContent className="p-0">
          <button
            onClick={() => toggleRow(rx.id)}
            className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
            aria-expanded={isExpanded}
            aria-controls={`details-panel-${rx.id}`}
            data-testid={`button-expand-rx-${rx.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`h-10 w-10 rounded-lg ${statusConfig.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <StatusIcon className={`h-5 w-5 ${statusConfig.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm truncate" data-testid={`text-rx-name-${rx.id}`}>
                      {rx.medication}
                    </h4>
                    <StatusBadge status={rx.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {formatDosage(rx)}
                    </span>
                    {formatFormAndVial(rx) && (
                      <span>{formatFormAndVial(rx)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(rx.submitted_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {rx.tracking_number && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium" data-testid={`badge-tracking-${rx.id}`}>
                    {rx.fedex_status || "Tracking"}
                  </span>
                )}
                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </div>
          </button>

          {isExpanded && (
            <div id={`details-panel-${rx.id}`} role="region" aria-label={`Details for ${rx.medication}`} className="border-t bg-gray-50/30 p-4 animate-in slide-in-from-top-1 duration-200" data-testid={`details-rx-${rx.id}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Instructions (SIG)</p>
                  <p className="text-gray-900">{rx.sig || "No instructions provided"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Quantity & Refills</p>
                  <p className="text-gray-900">
                    <span className="font-medium">{rx.quantity}</span> units · <span className="font-medium">{rx.refills}</span> refills
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Prescribed By</p>
                  <p className="text-gray-900 flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                    {rx.prescriber
                      ? `Dr. ${rx.prescriber.first_name} ${rx.prescriber.last_name}`
                      : "Unknown provider"}
                  </p>
                </div>
                {rx.tracking_number && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Tracking</p>
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-indigo-600" />
                      <a
                        href={`https://www.fedex.com/fedextrack/?trknbr=${rx.tracking_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-mono text-xs"
                        data-testid={`link-tracking-${rx.id}`}
                      >
                        {rx.tracking_number}
                      </a>
                      {rx.fedex_status && (
                        <span className="text-xs text-muted-foreground">· {rx.fedex_status}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEmrMedicationTable = (medications: Medication[], showActions: boolean) => {
    if (medications.length === 0) return null;

    return (
      <Card className="border shadow-sm" data-testid="card-emr-medications">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-gray-50/60">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Pill className="h-4 w-4 text-gray-500" />
              Manually Added Medications
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/40">
                  <TableHead className="text-xs font-semibold">Medication</TableHead>
                  <TableHead className="text-xs font-semibold">Dosage</TableHead>
                  <TableHead className="text-xs font-semibold">Frequency</TableHead>
                  <TableHead className="text-xs font-semibold">Start Date</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  {showActions && <TableHead className="text-xs font-semibold w-16">Edit</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map((med, idx) => (
                  <TableRow
                    key={med.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/30 transition-colors`}
                    data-testid={`row-emr-med-${med.id}`}
                  >
                    <TableCell className="font-medium text-sm">{med.name}</TableCell>
                    <TableCell className="text-sm text-gray-700">{med.dosage}</TableCell>
                    <TableCell className="text-sm text-gray-700">{med.frequency}</TableCell>
                    <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(med.startDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={med.status} />
                    </TableCell>
                    {showActions && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMedication(med)}
                          className="h-7 w-7 p-0 hover:bg-blue-50"
                          data-testid={`button-edit-med-${med.id}`}
                        >
                          <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = (isPast: boolean) => (
    <Card className="border border-dashed border-gray-200 shadow-none" data-testid={`empty-state-${isPast ? "past" : "current"}`}>
      <CardContent className="py-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Pill className="h-7 w-7 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">
          {isPast ? "No Past Medications" : "No Active Medications"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {isPast
            ? "Completed or discontinued medications will appear here."
            : "Active prescriptions and medications will appear here."}
        </p>
        {!isPast && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddMedication}
            className="mt-4"
            data-testid="button-add-med-empty"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Medication
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="animate-pulse flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                  <div className="h-5 w-8 bg-gray-200 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border shadow-sm">
          <CardContent className="p-4">
            <div className="animate-pulse flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (loading) return renderLoadingSkeleton();

  const hasCurrentData = filteredCurrentPrescriptions.length > 0 || filteredActiveMeds.length > 0;
  const hasPastData = filteredPastPrescriptions.length > 0 || filteredDiscontinuedMeds.length > 0;
  const hasAnyCurrent = currentPrescriptions.length > 0 || activeMeds.length > 0;
  const hasAnyPast = pastPrescriptions.length > 0 || discontinuedMeds.length > 0;

  return (
    <div className="space-y-5" data-testid="medications-tab">
      {renderKpiCards()}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search medications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-search-medications"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            disabled={loading}
            className="h-9"
            data-testid="button-refresh-meds"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleAddMedication}
            className="h-9 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
            data-testid="button-add-medication"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Medication
          </Button>
        </div>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="bg-gray-100 mb-4">
          <TabsTrigger value="current" className="data-[state=active]:bg-white px-5 py-2 text-sm" data-testid="tab-current-meds">
            Current
            {totalActive > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">
                {totalActive}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="past" className="data-[state=active]:bg-white px-5 py-2 text-sm" data-testid="tab-past-meds">
            Past
            {totalPast > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-600">
                {totalPast}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-3" data-testid="tab-content-current">
          {fetchError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="error-message">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {fetchError}
            </div>
          )}
          {!hasCurrentData && !hasAnyCurrent ? renderEmptyState(false) : !hasCurrentData && searchTerm ? (
            <Card className="border border-dashed border-gray-200 shadow-none">
              <CardContent className="py-8 text-center">
                <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-muted-foreground">No medications match &ldquo;{searchTerm}&rdquo;</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredCurrentPrescriptions.length > 0 && (
                <div className="space-y-2" data-testid="current-prescriptions-list">
                  {filteredCurrentPrescriptions.map(rx => renderPrescriptionCard(rx))}
                </div>
              )}
              {renderEmrMedicationTable(filteredActiveMeds, true)}
            </>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3" data-testid="tab-content-past">
          {!hasPastData && !hasAnyPast ? renderEmptyState(true) : !hasPastData && searchTerm ? (
            <Card className="border border-dashed border-gray-200 shadow-none">
              <CardContent className="py-8 text-center">
                <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-muted-foreground">No medications match &ldquo;{searchTerm}&rdquo;</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredPastPrescriptions.length > 0 && (
                <div className="space-y-2" data-testid="past-prescriptions-list">
                  {filteredPastPrescriptions.map(rx => renderPrescriptionCard(rx))}
                </div>
              )}
              {renderEmrMedicationTable(filteredDiscontinuedMeds, false)}
            </>
          )}
        </TabsContent>
      </Tabs>

      <MedicationModal
        isOpen={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        patientId={patientId}
        patientName={patientName}
        medication={editingMedication}
        onSuccess={handleMedModalSuccess}
      />
    </div>
  );
}
