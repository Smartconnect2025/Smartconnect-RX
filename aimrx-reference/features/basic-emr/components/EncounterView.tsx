"use client";

import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Lock,
  Mail,
  MapPin,
  Pill,
  Phone,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@core/auth";

import { INTAKE_DATA } from "../constants";
import { useEmrStore } from "../store/emr-store";
import {
  Encounter,
  EncounterStatusEnum,
  Patient,
  Vitals,
} from "../types";
import { IntakeModal } from "./IntakeModal";
import { VitalsSection } from "./VitalsSection";
import { NotesTab, BillingTabWrapper } from "./tabs";
import { IntakePanel, VitalsPanel } from "./panels";
import { PatientPrescriptionsTab } from "./PatientPrescriptionsTab";
import {
  BillingGroup,
  CreateBillingDiagnosisData,
  CreateBillingGroupData,
} from "../types/billing.types";
import { billingService } from "../services/billingService";
import {
  WorkflowContext,
  EncounterWorkflowType,
  BaseWorkflowProps,
  WorkflowTabConfig,
  WorkflowPanelConfig,
} from "../types/workflow.types";
import { getWorkflowConfigByEncounterType } from "../config/workflow-configs";

interface EncounterViewProps {
  patientId: string;
  encounterId: string;
  // Optional workflow override - if not provided, auto-detect from encounter
  workflowType?: EncounterWorkflowType;
  // Optional props for modular components - if not provided, use workflow defaults
  NotesComponent?: React.ComponentType<BaseWorkflowProps>;
  BillingComponent?: React.ComponentType<BaseWorkflowProps>;
  IntakeComponent?: React.ComponentType<BaseWorkflowProps>;
  VitalsComponent?: React.ComponentType<BaseWorkflowProps>;
}

export function EncounterView({
  patientId,
  encounterId,
  workflowType,
  NotesComponent,
  BillingComponent,
  IntakeComponent,
  VitalsComponent,
}: EncounterViewProps) {
  const router = useRouter();
  const { user } = useUser();

  const patients = useEmrStore((state) => state.patients);
  const currentPatient = useEmrStore((state) => state.currentPatient);
  const encounters = useEmrStore((state) => state.encounters);
  const currentEncounter = useEmrStore((state) => state.currentEncounter);
  const medications = useEmrStore((state) => state.medications);
  const conditions = useEmrStore((state) => state.conditions);
  const allergies = useEmrStore((state) => state.allergies);
  const loading = useEmrStore((state) => state.loading);
  const error = useEmrStore((state) => state.error);
  const fetchPatientById = useEmrStore((state) => state.fetchPatientById);
  const fetchEncounters = useEmrStore((state) => state.fetchEncounters);
  const fetchMedications = useEmrStore((state) => state.fetchMedications);
  const fetchConditions = useEmrStore((state) => state.fetchConditions);
  const fetchAllergies = useEmrStore((state) => state.fetchAllergies);
  const fetchOrders = useEmrStore((state) => state.fetchOrders);
  const fetchVitals = useEmrStore((state) => state.fetchVitals);
  const createVitals = useEmrStore((state) => state.createVitals);
  const updateVitalsAsync = useEmrStore((state) => state.updateVitalsAsync);
  const vitalsFromStore = useEmrStore((state) => state.vitals);
  const updateEncounterAsync = useEmrStore(
    (state) => state.updateEncounterAsync,
  );
  const setCurrentEncounter = useEmrStore((state) => state.setCurrentEncounter);
  const addendums = useEmrStore((state) => state.addendums);
  const fetchAddendums = useEmrStore((state) => state.fetchAddendums);
  const createAddendum = useEmrStore((state) => state.createAddendum);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [providerNotes, setProviderNotes] = useState("");
  const [isFinalized, setIsFinalized] = useState(false);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);

  const [isAddingAddendum, setIsAddingAddendum] = useState(false);

  // Order encounter specific state (currently unused - orders feature removed)
  const [orderDetails] = useState<{
    id: string;
    title: string;
    details?: string;
    order_type: string;
    ordered_at: string;
    status: string;
  } | null>(null);
  const [isLoadingOrderAction, setIsLoadingOrderAction] = useState(false);

  const [billingGroups, setBillingGroups] = useState<BillingGroup[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [localBillingChanges, setLocalBillingChanges] = useState<{
    procedureCodes: Record<string, { code: string; description: string }>;
    modifiers: Record<string, string>;
    diagnoses: {
      added: Array<{ groupId: string; diagnosis: CreateBillingDiagnosisData }>;
      removed: string[];
      primaryToggles: Array<{
        dxId: string;
        groupId: string;
        isPrimary: boolean;
      }>;
    };
    billingGroups: {
      added: Array<CreateBillingGroupData>;
      removed: string[];
    };
  }>({
    procedureCodes: {},
    modifiers: {},
    diagnoses: { added: [], removed: [], primaryToggles: [] },
    billingGroups: { added: [], removed: [] },
  });

  const currentVitals = vitalsFromStore.find(
    (vitals: Vitals) => vitals.encounterId === encounterId,
  );

  const [vitalsEdit, setVitalsEdit] = useState({
    bp: "",
    hr: "",
    temp: "",
    resp: "",
    spo2: "",
    weight: "",
    height: "",
    bmi: "",
  });

  const [vitalsModified, setVitalsModified] = useState(false);

  // Get workflow configuration
  const workflowConfig = getWorkflowConfigByEncounterType(
    workflowType || encounter?.businessType,
  );

  // Determine if we should use the new workflow system
  const useWorkflowSystem =
    workflowConfig.type === "d2c" || workflowConfig.type === "coaching";

  // Use workflow components or fallback to defaults
  const NotesComponentToUse =
    NotesComponent ||
    workflowConfig.tabs.find((t: WorkflowTabConfig) => t.id === "notes")
      ?.component ||
    NotesTab;
  const BillingComponentToUse =
    BillingComponent ||
    workflowConfig.tabs.find((t: WorkflowTabConfig) => t.id === "billing")
      ?.component ||
    BillingTabWrapper;
  const IntakeComponentToUse =
    IntakeComponent ||
    workflowConfig.panels.find((p: WorkflowPanelConfig) => p.id === "intake")
      ?.component ||
    IntakePanel;
  const VitalsComponentToUse =
    VitalsComponent ||
    workflowConfig.panels.find((p: WorkflowPanelConfig) => p.id === "vitals")
      ?.component ||
    VitalsPanel;

  // Create workflow context (only for new workflow system)
  const workflowContext: WorkflowContext = {
    workflowType: workflowConfig.type,
    config: workflowConfig,
    encounterId,
    patientId,
    userId: user?.id || "",
  };

  useEffect(() => {
    if (vitalsEdit.weight && vitalsEdit.height) {
      // Parse height (assuming format like "5'10" or "70")
      let heightInInches = 0;
      const heightStr = vitalsEdit.height.trim();

      if (heightStr.includes("'")) {
        const parts = heightStr.split("'");
        const feet = parseInt(parts[0]) || 0;
        const inches = parseInt(parts[1]?.replace('"', "") || "0") || 0;
        heightInInches = feet * 12 + inches;
      } else {
        // Assume inches
        heightInInches = parseInt(heightStr) || 0;
      }

      const weightLbs = parseFloat(vitalsEdit.weight) || 0;

      if (heightInInches > 0 && weightLbs > 0) {
        // BMI = (weight in pounds / (height in inches)²) × 703
        const bmi = (weightLbs / (heightInInches * heightInInches)) * 703;
        setVitalsEdit((prev) => ({ ...prev, bmi: bmi.toFixed(1) }));
      } else {
        setVitalsEdit((prev) => ({ ...prev, bmi: "" }));
      }
    } else {
      setVitalsEdit((prev) => ({ ...prev, bmi: "" }));
    }
  }, [vitalsEdit.weight, vitalsEdit.height]);

  // Fetch all encounter-related data when component mounts
  useEffect(() => {
    if (user?.id && patientId && encounterId) {
      const loadEncounterData = async () => {
        await fetchPatientById(patientId, user.id);

        await fetchEncounters(patientId, user.id);

        await Promise.all([
          fetchMedications(patientId, user.id),
          fetchConditions(patientId, user.id),
          fetchAllergies(patientId, user.id),
          fetchOrders(encounterId, user.id),
          fetchVitals(encounterId, user.id),
          fetchAddendums(encounterId, user.id),
        ]);

        try {
          setBillingLoading(true);
          const response = await billingService.getBillingGroups(
            encounterId,
            user.id,
          );
          if (response.success) {
            setBillingGroups(response.data || []);
          } else {
            setBillingError(response.error || "Failed to fetch billing data");
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to fetch billing data";
          setBillingError(errorMessage);
        } finally {
          setBillingLoading(false);
        }
      };

      loadEncounterData();
    }
  }, [
    user?.id,
    patientId,
    encounterId,
    fetchPatientById,
    fetchEncounters,
    fetchMedications,
    fetchConditions,
    fetchAllergies,
    fetchOrders,
    fetchVitals,
    fetchAddendums,
    setBillingGroups,
    setBillingLoading,
    setBillingError,
  ]);

  // Load order details for order-based encounters (including async)
  useEffect(() => {
    // Order details loading removed - orders feature not available
    // TODO: Implement prescription-based order loading when needed
    const loadOrderDetails = async () => {
      // Placeholder for future implementation
    };

    loadOrderDetails();
  }, [encounter?.businessType, encounter?.orderId]);

  // Update local state when store updates
  useEffect(() => {
    // Set patient
    if (currentPatient && currentPatient.id === patientId) {
      setPatient(currentPatient);
    } else {
      const foundPatient = patients.find(
        (patient: Patient) => patient.id === patientId,
      );
      if (foundPatient) {
        setPatient(foundPatient);
      }
    }

    // Set encounter
    if (currentEncounter && currentEncounter.id === encounterId) {
      setEncounter(currentEncounter);
      setIsFinalized(currentEncounter.status === "completed");
      if (currentEncounter.providerNotes) {
        setProviderNotes(currentEncounter.providerNotes);
      }
    } else {
      const foundEncounter = encounters.find(
        (encounter: Encounter) => encounter.id === encounterId,
      );
      if (foundEncounter) {
        setEncounter(foundEncounter);
        setCurrentEncounter(foundEncounter);
        setIsFinalized(foundEncounter.status === "completed");
        if (foundEncounter.providerNotes) {
          setProviderNotes(foundEncounter.providerNotes);
        }
      }
    }

    // Set vitals from backend data (only if not modified locally)
    if (currentVitals && !vitalsModified) {
      setVitalsEdit({
        bp: currentVitals.bloodPressure || "",
        hr: currentVitals.heartRate || "",
        temp: currentVitals.temperature || "",
        resp: currentVitals.respiratoryRate || "",
        spo2: currentVitals.bloodOxygen || "",
        weight: currentVitals.weight || "",
        height: currentVitals.height || "",
        bmi: currentVitals.bmi || "",
      });
    }
  }, [
    currentPatient,
    patients,
    patientId,
    currentEncounter,
    encounters,
    encounterId,
    currentVitals,
    setCurrentEncounter,
    vitalsModified,
  ]);

  // Handle unauthenticated user
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Please log in to view encounter
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Loading encounter...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Data not found
  if (!patient || !encounter) {
    return (
      <div className="p-8 bg-gray-100 min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800">
            {!patient ? "Patient not found" : "Encounter not found"}
          </h2>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const getPatientInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleSaveBillingChanges = async () => {
    if (
      Object.keys(localBillingChanges.procedureCodes).length > 0 ||
      Object.keys(localBillingChanges.modifiers).length > 0 ||
      localBillingChanges.diagnoses.added.length > 0 ||
      localBillingChanges.diagnoses.removed.length > 0 ||
      localBillingChanges.diagnoses.primaryToggles.length > 0 ||
      localBillingChanges.billingGroups.added.length > 0 ||
      localBillingChanges.billingGroups.removed.length > 0
    ) {
      try {
        const procedurePromises = Object.entries(
          localBillingChanges.procedureCodes,
        ).map(async ([groupId, data]) => {
          await billingService.updateBillingGroup(groupId, user!.id, {
            procedureCode: data.code,
            procedureDescription: data.description,
          });
        });

        const modifiersPromises = Object.entries(
          localBillingChanges.modifiers,
        ).map(async ([groupId, value]) => {
          await billingService.updateBillingGroup(groupId, user!.id, {
            modifiers: value,
          });
        });

        const diagnosisPromises = [
          ...localBillingChanges.diagnoses.added.map(async (item) => {
            await billingService.createBillingDiagnosis(
              user!.id,
              item.diagnosis,
            );
          }),
          ...localBillingChanges.diagnoses.removed.map(async (dxId) => {
            await billingService.deleteBillingDiagnosis(dxId, user!.id);
          }),
          ...localBillingChanges.diagnoses.primaryToggles.map(async (item) => {
            await billingService.updateBillingDiagnosis(item.dxId, user!.id, {
              isPrimary: item.isPrimary,
            });
          }),
        ];

        const billingGroupPromises = [
          ...localBillingChanges.billingGroups.added.map(async (groupData) => {
            await billingService.createBillingGroup(user!.id, groupData);
          }),
          ...localBillingChanges.billingGroups.removed.map(async (groupId) => {
            await billingService.deleteBillingGroup(groupId, user!.id);
          }),
        ];

        await Promise.all([
          ...procedurePromises,
          ...modifiersPromises,
          ...diagnosisPromises,
          ...billingGroupPromises,
        ]);

        setLocalBillingChanges({
          procedureCodes: {},
          modifiers: {},
          diagnoses: { added: [], removed: [], primaryToggles: [] },
          billingGroups: { added: [], removed: [] },
        });
      } catch (err) {
        console.error("Error saving billing changes:", err);
        throw new Error("Failed to save billing changes");
      }
    }
  };

  const handleFinalize = async () => {
    if (!user?.id || !encounter || !patient) return;

    if (vitalsModified) {
      await handleSaveVitals();
    }

    await handleSaveBillingChanges();

    const updates: Partial<Encounter> = {
      status: EncounterStatusEnum.Completed,
      providerNotes: providerNotes,
      finalizedAt: new Date().toISOString(),
      finalizedBy: user.id,
    };

    const result = await updateEncounterAsync(encounter.id, user.id, updates);
    if (result) {
      setIsFinalized(true);
    }
  };

  // Billing functionality is now handled by the BillingTab component

  const handleSaveVitals = async () => {
    if (!user?.id || !patient || !encounter) return;

    if (currentVitals) {
      const hasChanged =
        vitalsEdit.bp !== (currentVitals.bloodPressure || "") ||
        vitalsEdit.hr !== (currentVitals.heartRate || "") ||
        vitalsEdit.temp !== (currentVitals.temperature || "") ||
        vitalsEdit.resp !== (currentVitals.respiratoryRate || "") ||
        vitalsEdit.spo2 !== (currentVitals.bloodOxygen || "") ||
        vitalsEdit.weight !== (currentVitals.weight || "") ||
        vitalsEdit.height !== (currentVitals.height || "") ||
        vitalsEdit.bmi !== (currentVitals.bmi || "");

      if (!hasChanged) return;
    }

    const vitalsData = {
      patientId: patient.id,
      encounterId: encounter.id,
      bloodPressure: vitalsEdit.bp,
      heartRate: vitalsEdit.hr,
      temperature: vitalsEdit.temp,
      respiratoryRate: vitalsEdit.resp,
      bloodOxygen: vitalsEdit.spo2,
      weight: vitalsEdit.weight,
      height: vitalsEdit.height,
    };

    if (currentVitals) {
      await updateVitalsAsync(currentVitals.id, user.id, vitalsData);
    } else {
      const hasData = Object.values(vitalsEdit).some(
        (value) => value.trim() !== "",
      );
      if (hasData) {
        await createVitals(user.id, vitalsData);
      }
    }

    setVitalsModified(false);
  };

  const handleVitalsChange = (field: string, value: string) => {
    if (["hr", "temp", "resp", "spo2", "weight"].includes(field)) {
      // Allow empty string or valid numbers (including decimals for weight and temp)
      if (value !== "" && !/^\d*\.?\d*$/.test(value)) {
        return;
      }
    }

    setVitalsEdit((prev) => ({ ...prev, [field]: value }));
    setVitalsModified(true);
  };

  const handleAddAddendum = () => {
    setIsAddingAddendum(true);
  };

  const handleSaveAddendum = async (content: string) => {
    if (!user?.id || !encounter) return;

    const result = await createAddendum(user.id, encounter.id, content);

    if (result) {
      setIsAddingAddendum(false);
    }
  };

  const handleCancelAddendum = () => {
    setIsAddingAddendum(false);
  };

  // Order encounter specific functions
  const handleApproveOrder = async () => {
    if (!encounter?.orderId || !user?.id) return;

    setIsLoadingOrderAction(true);
    try {
      // Update encounter status
      const encounterUpdate = await updateEncounterAsync(
        encounter.id,
        user.id,
        {
          status: "completed",
          providerNotes: providerNotes + "\n\nOrder APPROVED",
        },
      );

      // Order status update removed - orders feature not available
      // TODO: Implement prescription approval when needed

      if (encounterUpdate) {
        setIsFinalized(true);
      }
    } catch (error) {
      console.error("Error approving order:", error);
    } finally {
      setIsLoadingOrderAction(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!encounter?.orderId || !user?.id) return;

    setIsLoadingOrderAction(true);
    try {
      // Update encounter status
      const encounterUpdate = await updateEncounterAsync(
        encounter.id,
        user.id,
        {
          status: "completed",
          providerNotes: providerNotes + "\n\nOrder REJECTED",
        },
      );
      // Order status update removed - orders feature not available
      // TODO: Implement prescription rejection when needed

      if (encounterUpdate) {
        setIsFinalized(true);
      }
    } catch (error) {
      console.error("Error rejecting order:", error);
    } finally {
      setIsLoadingOrderAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      {/* Left Sidebar */}
      <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col hidden lg:flex">
        {/* Patient Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 sm:space-x-4 mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-base sm:text-lg">
              {getPatientInitials(patient.firstName, patient.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  {patient.firstName} {patient.lastName}
                </h2>
              </div>
              {/* <p className="text-gray-600">{patient.id}</p> */}
            </div>
          </div>

          {/* Patient Details */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                DOB: {formatDate(patient.dateOfBirth)}
              </span>
            </div>
            {patient.phone && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{patient.phone}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{patient.email}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {patient.address.street}, {patient.address.city},{" "}
                  {patient.address.state} {patient.address.zipCode}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Medications Section */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <span className="mr-2">Medications</span>
              <button className="text-gray-400 hover:text-gray-600">
                <span className="text-sm">▼</span>
              </button>
            </h3>
            <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 flex-shrink-0" />
          </div>
          <div className="space-y-3">
            {medications.length === 0 ? (
              <p className="text-gray-500 text-sm">No medications recorded</p>
            ) : (
              medications.slice(0, 2).map((medication) => (
                <div key={medication.id} className="text-sm">
                  <div className="font-medium text-gray-900">
                    {medication.name}
                  </div>
                  <div className="text-gray-600">
                    {medication.dosage}, {medication.frequency}
                    {medication.startDate &&
                      `, Started ${formatDate(medication.startDate)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conditions Section */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <span className="mr-2">Conditions</span>
              <button className="text-gray-400 hover:text-gray-600">
                <span className="text-sm">▼</span>
              </button>
            </h3>
            <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 flex-shrink-0" />
          </div>
          <div className="space-y-3">
            {conditions.length === 0 ? (
              <p className="text-gray-500 text-sm">No conditions recorded</p>
            ) : (
              conditions.slice(0, 2).map((condition) => (
                <div key={condition.id} className="text-sm">
                  <div className="font-medium text-gray-900">
                    {condition.name}
                  </div>
                  <div className="text-gray-600">
                    {condition.status}, {condition.severity}
                    {condition.onsetDate &&
                      `, Onset ${formatDate(condition.onsetDate)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Allergies Section */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <span className="mr-2">Allergies</span>
              <button className="text-gray-400 hover:text-gray-600">
                <span className="text-sm">▼</span>
              </button>
            </h3>
            <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 flex-shrink-0" />
          </div>
          <div className="space-y-3">
            {allergies.length === 0 ? (
              <p className="text-gray-500 text-sm">No allergies recorded</p>
            ) : (
              allergies.map((allergy) => (
                <div key={allergy.id} className="text-sm">
                  <div className="font-medium text-gray-900">
                    {allergy.name}
                  </div>
                  <div className="text-gray-600">
                    {allergy.reactionType}, {allergy.severity}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="p-2 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
                  {encounter.title}
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  {format(encounter.date, "EEEE, MMMM d, yyyy • h:mm a")}
                </p>
              </div>
            </div>
            {useWorkflowSystem && workflowConfig.headerActions ? (
              // Use workflow-specific header actions (only for D2C and coaching)
              <workflowConfig.headerActions.component
                encounter={encounter}
                isFinalized={isFinalized}
                loading={loading}
                onFinalize={handleFinalize}
                onApproveOrder={handleApproveOrder}
                onRejectOrder={handleRejectOrder}
                isLoadingOrderAction={isLoadingOrderAction}
                {...workflowConfig.headerActions.props}
              />
            ) : encounter?.businessType === "order_based" ||
              encounter?.businessType === "order_based_async" ||
              encounter?.businessType === "order_based_sync" ? (
              // Order-based encounter buttons (including async orders)
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {!isFinalized ? (
                  <>
                    <Button
                      onClick={handleApproveOrder}
                      disabled={isLoadingOrderAction}
                      variant="default"
                      className="w-full sm:w-auto"
                    >
                      Approve Order
                    </Button>
                    <Button
                      onClick={handleRejectOrder}
                      disabled={isLoadingOrderAction}
                      variant="outline"
                      className="border border-border w-full sm:w-auto"
                    >
                      Reject Order
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-gray-900 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Order reviewed
                  </span>
                )}
              </div>
            ) : (
              // Default encounter finalize button + Create Prescription
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Link
                  href={`/prescriptions/new/step1?patientId=${patientId}&encounterId=${encounterId}${encounter?.appointmentId ? `&appointmentId=${encounter.appointmentId}` : ""}`}
                >
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <Pill className="mr-2 h-4 w-4" />
                    Create Prescription
                  </Button>
                </Link>
                <Button
                  onClick={handleFinalize}
                  disabled={isFinalized || loading}
                  variant="default"
                  className="disabled:bg-gray-300 w-full sm:w-auto"
                >
                  {loading ? (
                    "Saving..."
                  ) : isFinalized ? (
                    <span className="text-sm text-gray-900 flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Encounter finalized
                    </span>
                  ) : (
                    "Finalize"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white px-4">
          {useWorkflowSystem && workflowConfig.customLayout ? (
            // Use custom workflow layout
            <workflowConfig.customLayout.component
              encounter={encounter}
              isFinalized={isFinalized}
              loading={loading}
              context={workflowContext}
              {...workflowConfig.customLayout.props}
            >
              {/* Render panels */}
              {workflowConfig.panels
                .filter((panel: WorkflowPanelConfig) => panel.visible !== false)
                .sort(
                  (a: WorkflowPanelConfig, b: WorkflowPanelConfig) =>
                    (a.order || 0) - (b.order || 0),
                )
                .map((panel: WorkflowPanelConfig) => {
                  const PanelComponent = panel.component;
                  return (
                    <PanelComponent
                      key={panel.id}
                      encounter={encounter}
                      isFinalized={isFinalized}
                      loading={loading}
                      {...panel.props}
                    />
                  );
                })}
            </workflowConfig.customLayout.component>
          ) : encounter?.businessType === "order_based" ||
            encounter?.businessType === "order_based_async" ||
            encounter?.businessType === "order_based_sync" ? (
            // Order-based encounter view - original UI (including async orders)
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row h-full gap-6">
                <div className="flex-1">
                  {/* Order Details Section */}
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Order Details
                    </h2>
                    {orderDetails ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-medium text-gray-900">
                            {orderDetails.title}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {orderDetails.order_type}
                          </span>
                        </div>
                        {orderDetails.details && (
                          <p className="text-gray-600 mb-2">
                            {orderDetails.details}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Ordered:{" "}
                          {format(
                            new Date(orderDetails.ordered_at),
                            "MMMM d, yyyy 'at' h:mm a",
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-500">
                          Loading order details...
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Billing Details Section */}
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Billing Information
                    </h2>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Payment Status
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Paid</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Amount
                          </h4>
                          <span className="text-lg font-semibold text-gray-900">
                            $150.00
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Payment Method
                          </h4>
                          <span className="text-sm text-gray-600">
                            Credit Card (****1234)
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Invoice
                          </h4>
                          <button className="text-sm text-blue-600 hover:text-blue-800 underline">
                            View Invoice
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Provider Notes Section */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Provider Notes
                    </h2>
                    <Textarea
                      value={providerNotes}
                      onChange={(e) => setProviderNotes(e.target.value)}
                      disabled={isFinalized}
                      className="w-full h-96 font-mono text-sm border-gray-300 resize-none"
                      placeholder="Enter clinical notes about this order..."
                    />
                  </div>
                </div>

                <aside className="w-full lg:w-80 space-y-6">
                  {/* Intake */}
                  <Button
                    variant="outline"
                    className="w-full justify-between py-2 h-auto bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-sm"
                    onClick={() => setIsIntakeModalOpen(true)}
                  >
                    <div className="flex flex-col items-start">
                      <h4 className="font-medium text-gray-900">Intake</h4>
                      <p className="text-sm text-gray-600">
                        {format(encounter.date, "MMMM d, yyyy")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(encounter.date, "h:mm a")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  {/* Vitals */}
                  <VitalsSection
                    vitalsEdit={vitalsEdit}
                    isFinalized={isFinalized}
                    onVitalsChange={handleVitalsChange}
                  />
                </aside>
              </div>
            </div>
          ) : (
            // Clinical encounter view - original UI with tabs
            <Tabs defaultValue="notes" className="w-full h-full">
              <div className="mt-6 mb-0">
                <div className="overflow-x-auto">
                  <TabsList className="w-max min-w-full rounded-none justify-start">
                    <TabsTrigger
                      value="notes"
                      className="data-[state=active]:bg-white bg-gray-100 whitespace-nowrap flex-shrink-0"
                    >
                      Notes
                    </TabsTrigger>
                    <TabsTrigger
                      value="prescriptions"
                      className="data-[state=active]:bg-white bg-gray-100 whitespace-nowrap flex-shrink-0"
                    >
                      Prescriptions
                    </TabsTrigger>
                    {/* Dynamically add Order Review tab for appointment encounters with linked orders */}
                    {encounter?.businessType === "appointment_based" &&
                      encounter?.orderId && (
                        <TabsTrigger
                          value="order-review"
                          className="data-[state=active]:bg-white bg-gray-100"
                        >
                          Order Review
                        </TabsTrigger>
                      )}
                    <TabsTrigger
                      value="billing"
                      className="data-[state=active]:bg-white bg-gray-100 whitespace-nowrap flex-shrink-0"
                    >
                      <span className="hidden sm:inline">Coding & Billing</span>
                      <span className="sm:hidden">Billing</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <TabsContent
                value="notes"
                className="flex-1 p-4 sm:p-6 lg:p-8 pt-6"
              >
                <div className="flex flex-col lg:flex-row h-full gap-6">
                  <NotesComponentToUse
                    encounter={encounter}
                    isFinalized={isFinalized}
                    loading={loading}
                    providerNotes={providerNotes}
                    onProviderNotesChange={setProviderNotes}
                    finalizedDate={
                      encounter.finalizedAt
                        ? new Date(encounter.finalizedAt)
                        : null
                    }
                    onAddAddendum={handleAddAddendum}
                    isAddingAddendum={isAddingAddendum}
                    addendums={addendums.filter(
                      (addendum) => addendum.encounterId === encounterId,
                    )}
                    onSaveAddendum={handleSaveAddendum}
                    onCancelAddendum={handleCancelAddendum}
                  >
                    <IntakeComponentToUse
                      encounter={encounter}
                      isFinalized={isFinalized}
                      loading={loading}
                      onOpenIntake={() => setIsIntakeModalOpen(true)}
                    />
                    <VitalsComponentToUse
                      encounter={encounter}
                      isFinalized={isFinalized}
                      loading={loading}
                      vitalsEdit={vitalsEdit}
                      onVitalsChange={handleVitalsChange}
                    />
                  </NotesComponentToUse>
                </div>
              </TabsContent>

              <TabsContent value="prescriptions" className="p-4 sm:p-6 lg:p-8">
                <PatientPrescriptionsTab patientId={patientId} />
              </TabsContent>

              {/* Order Review tab content for appointment encounters with linked orders */}
              {encounter?.businessType === "appointment_based" &&
                encounter?.orderId && (
                  <TabsContent value="order-review" className="p-8">
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Order Review
                      </h2>

                      {orderDetails ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-medium text-gray-900">
                              {orderDetails.title}
                            </h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {orderDetails.order_type}
                            </span>
                          </div>
                          {orderDetails.details && (
                            <p className="text-gray-600 mb-2">
                              {orderDetails.details}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            Ordered:{" "}
                            {format(
                              new Date(orderDetails.ordered_at),
                              "MMMM d, yyyy 'at' h:mm a",
                            )}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-gray-500">
                            Loading order details...
                          </p>
                        </div>
                      )}

                      {/* Order Review Actions */}
                      {!isFinalized && (
                        <div className="flex space-x-3 pt-4 border-t">
                          <Button
                            onClick={handleApproveOrder}
                            disabled={isLoadingOrderAction}
                            variant="default"
                          >
                            Approve Order
                          </Button>
                          <Button
                            onClick={handleRejectOrder}
                            disabled={isLoadingOrderAction}
                            variant="outline"
                            className="border border-border"
                          >
                            Reject Order
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )}

              <TabsContent value="billing" className="p-4 sm:p-6 lg:p-8">
                {user && encounter && (
                  <BillingComponentToUse
                    encounter={encounter}
                    isFinalized={isFinalized}
                    loading={loading}
                    encounterId={encounter.id}
                    userId={user.id}
                    billingGroups={billingGroups}
                    setBillingGroups={setBillingGroups}
                    billingLoading={billingLoading}
                    setBillingLoading={setBillingLoading}
                    billingError={billingError}
                    setBillingError={setBillingError}
                    localBillingChanges={localBillingChanges}
                    setLocalBillingChanges={setLocalBillingChanges}
                  />
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Intake Modal */}
      <IntakeModal
        isOpen={isIntakeModalOpen}
        onClose={() => setIsIntakeModalOpen(false)}
        intakeData={INTAKE_DATA}
      />
    </div>
  );
}
