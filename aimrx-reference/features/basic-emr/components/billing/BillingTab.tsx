"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { billingService } from "../../services/billingService";
import {
  BillingGroup,
  CreateBillingDiagnosisData,
  CreateBillingGroupData,
} from "../../types/billing.types";
import { AddDiagnosisModal } from "../AddDiagnosisModal";
import { BillingGroup as BillingGroupComponent } from "./BillingGroup";
import { BillingOperations } from "./BillingOperations";
import { getProcedureDescription } from "./helpers";

interface BillingTabProps {
  encounterId: string;
  userId: string;
  isFinalized: boolean;
  billingGroups: BillingGroup[];
  setBillingGroups: React.Dispatch<React.SetStateAction<BillingGroup[]>>;
  billingLoading: boolean;
  setBillingLoading: React.Dispatch<React.SetStateAction<boolean>>;
  billingError: string | null;
  setBillingError: React.Dispatch<React.SetStateAction<string | null>>;
  localBillingChanges: LocalChanges;
  setLocalBillingChanges: React.Dispatch<React.SetStateAction<LocalChanges>>;
}

interface LocalChanges {
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
}

interface DiagnosisToAdd {
  name: string;
  code: string;
}

const LoadingState = () => (
  <div className="flex justify-center py-8">
    <div className="text-gray-500">Loading billing information...</div>
  </div>
);

const ErrorState = ({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) => (
  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
    <div className="text-red-600 font-medium">
      Error loading billing information
    </div>
    <div className="text-red-500 text-sm mt-1">{error}</div>
    <Button onClick={onRetry} className="mt-3" variant="outline">
      Retry
    </Button>
  </div>
);

const AddProcedureButton = ({
  isFinalized,
  onAdd,
}: {
  isFinalized: boolean;
  onAdd: () => void;
}) => {
  if (isFinalized) return null;

  return (
    <div className="flex justify-center">
      <Button
        variant="outline"
        className="w-full flex items-center space-x-2 text-gray-600 bg-white hover:bg-gray-100"
        onClick={onAdd}
      >
        <span>Add Procedure</span>
      </Button>
    </div>
  );
};

export const BillingTab: React.FC<BillingTabProps> = ({
  encounterId,
  userId,
  isFinalized,
  billingGroups,
  setBillingGroups,
  billingLoading,
  setBillingLoading,
  billingError,
  setBillingError,
  localBillingChanges: _localBillingChanges,
  setLocalBillingChanges,
}) => {
  const [isAddDxModalOpen, setIsAddDxModalOpen] = useState(false);
  const [currentBillingGroupId, setCurrentBillingGroupId] = useState<
    string | null
  >(null);

  const operations = useMemo(
    () =>
      new BillingOperations(userId, setBillingGroups, setLocalBillingChanges),
    [userId, setBillingGroups, setLocalBillingChanges],
  );

  const retryFetch = useCallback(async () => {
    setBillingLoading(true);
    setBillingError(null);

    try {
      const response = await billingService.getBillingGroups(
        encounterId,
        userId,
      );

      if (response.success) {
        setBillingGroups(response.data || []);
      } else {
        setBillingError(response.error || "Unknown error");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setBillingError(errorMessage);
    } finally {
      setBillingLoading(false);
    }
  }, [
    encounterId,
    userId,
    setBillingGroups,
    setBillingLoading,
    setBillingError,
  ]);

  const handleProcedureCodeChange = useCallback(
    (groupId: string, value: string) =>
      operations.updateProcedureCode(groupId, value),
    [operations],
  );

  const handleModifiersChange = useCallback(
    (groupId: string, value: string) =>
      operations.updateModifiers(groupId, value),
    [operations],
  );

  const handleTogglePrimaryDx = useCallback(
    (dxId: string, groupId: string) =>
      operations.togglePrimaryDiagnosis(dxId, groupId, billingGroups),
    [operations, billingGroups],
  );

  const handleRemoveDx = useCallback(
    (dxId: string, groupId: string) =>
      operations.removeDiagnosis(dxId, groupId, billingGroups),
    [operations, billingGroups],
  );

  const handleRemoveProcedure = useCallback(
    (procId: string) => operations.removeProcedure(procId),
    [operations],
  );

  const handleRemoveBillingGroup = useCallback(
    (groupId: string) => operations.removeBillingGroup(groupId),
    [operations],
  );

  const handleAddNewBillingGroup = useCallback(
    () => operations.createBillingGroup(encounterId),
    [operations, encounterId],
  );

  const handleOpenAddDx = useCallback(
    (groupId: string) => {
      setCurrentBillingGroupId(groupId);
      setIsAddDxModalOpen(true);
    },
    [setCurrentBillingGroupId, setIsAddDxModalOpen],
  );

  const handleAddDiagnosis = useCallback(
    async (diagnosis: DiagnosisToAdd) => {
      if (!currentBillingGroupId) return;

      const currentGroup = billingGroups.find(
        (group) => group.id === currentBillingGroupId,
      );
      const isFirstDiagnosis = currentGroup?.diagnoses.length === 0;

      const diagnosisData: CreateBillingDiagnosisData = {
        billingGroupId: currentBillingGroupId,
        icdCode: diagnosis.code,
        description: diagnosis.name,
        isPrimary: isFirstDiagnosis,
      };

      const success = await operations.createDiagnosis(diagnosisData);

      if (success) {
        setIsAddDxModalOpen(false);
        setCurrentBillingGroupId(null);
        toast.success("Diagnosis added successfully");
      } else {
        toast.error("Failed to add diagnosis");
      }
    },
    [
      currentBillingGroupId,
      billingGroups,
      operations,
      setIsAddDxModalOpen,
      setCurrentBillingGroupId,
    ],
  );

  const handleCancelAddDx = useCallback(() => {
    setIsAddDxModalOpen(false);
    setCurrentBillingGroupId(null);
  }, [setIsAddDxModalOpen, setCurrentBillingGroupId]);

  const billingGroupComponents = useMemo(
    () =>
      billingGroups.map((group) => (
        <BillingGroupComponent
          key={group.id}
          group={group}
          isFinalized={isFinalized}
          onProcedureCodeChange={handleProcedureCodeChange}
          onModifiersChange={handleModifiersChange}
          onTogglePrimaryDx={handleTogglePrimaryDx}
          onRemoveDx={handleRemoveDx}
          onRemoveProcedure={handleRemoveProcedure}
          onRemoveGroup={handleRemoveBillingGroup}
          onAddDiagnosis={handleOpenAddDx}
          getProcedureDescription={getProcedureDescription}
        />
      )),
    [
      billingGroups,
      isFinalized,
      handleProcedureCodeChange,
      handleModifiersChange,
      handleTogglePrimaryDx,
      handleRemoveDx,
      handleRemoveProcedure,
      handleRemoveBillingGroup,
      handleOpenAddDx,
    ],
  );

  if (billingLoading) return <LoadingState />;

  if (billingError)
    return <ErrorState error={billingError} onRetry={retryFetch} />;

  return (
    <div className="space-y-6">
      {billingGroupComponents}

      <AddProcedureButton
        isFinalized={isFinalized}
        onAdd={handleAddNewBillingGroup}
      />

      <AddDiagnosisModal
        isOpen={isAddDxModalOpen}
        onClose={handleCancelAddDx}
        onAddDiagnosis={handleAddDiagnosis}
        isFinalized={isFinalized}
      />
    </div>
  );
};
