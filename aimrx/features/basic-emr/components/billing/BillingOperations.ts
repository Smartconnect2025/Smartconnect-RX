import { billingService } from "../../services/billingService";
import {
  BillingGroup,
  CreateBillingDiagnosisData,
  CreateBillingGroupData,
  BillingDiagnosis,
} from "../../types/billing.types";
import {
  findBillingGroup,
  findDiagnosis,
  getProcedureDescription,
} from "./helpers";

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

export class BillingOperations {
  constructor(
    private userId: string,
    private updateBillingGroups: (
      updater: (prev: BillingGroup[]) => BillingGroup[]
    ) => void,
    private updateLocalChanges: (
      updater: (prev: LocalChanges) => LocalChanges
    ) => void
  ) {}

  async updateProcedureCode(groupId: string, value: string): Promise<void> {
    const description = getProcedureDescription(value);

    this.updateBillingGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              procedureCode: value,
              procedureDescription: description,
            }
          : group
      )
    );

    this.updateLocalChanges((prev) => ({
      ...prev,
      procedureCodes: {
        ...prev.procedureCodes,
        [groupId]: { code: value, description },
      },
    }));
  }

  async updateModifiers(groupId: string, value: string): Promise<void> {
    this.updateBillingGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, modifiers: value } : group
      )
    );

    this.updateLocalChanges((prev) => ({
      ...prev,
      modifiers: {
        ...prev.modifiers,
        [groupId]: value,
      },
    }));
  }

  async togglePrimaryDiagnosis(
    dxId: string,
    groupId: string,
    billingGroups: BillingGroup[]
  ): Promise<void> {
    const group = findBillingGroup(billingGroups, groupId);
    if (!group) {
      return;
    }

    const diagnosis = findDiagnosis(group, dxId);
    if (!diagnosis) {
      return;
    }

    if (diagnosis.isPrimary) {
      return;
    }

    this.updateBillingGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              diagnoses: group.diagnoses.map((dx) => ({
                ...dx,
                isPrimary: dx.id === dxId ? true : false,
              })),
            }
          : group
      )
    );

    this.updateLocalChanges((prev) => ({
      ...prev,
      diagnoses: {
        ...prev.diagnoses,
        primaryToggles: [
          ...prev.diagnoses.primaryToggles,
          { dxId, groupId, isPrimary: true },
        ],
      },
    }));
  }

  async removeDiagnosis(
    dxId: string,
    groupId: string,
    billingGroups: BillingGroup[]
  ): Promise<void> {
    const currentGroup = findBillingGroup(billingGroups, groupId);
    if (currentGroup) {
      const primaryDiagnoses = currentGroup.diagnoses.filter(
        (dx) => dx.isPrimary
      );
      const isRemovingPrimary = currentGroup.diagnoses.find(
        (dx) => dx.id === dxId
      )?.isPrimary;

      if (
        isRemovingPrimary &&
        primaryDiagnoses.length === 1 &&
        currentGroup.diagnoses.length > 1
      ) {
        return;
      }
    }

    this.updateBillingGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              diagnoses: group.diagnoses.filter((dx) => dx.id !== dxId),
            }
          : group
      )
    );

    this.updateLocalChanges((prev) => ({
      ...prev,
      diagnoses: {
        ...prev.diagnoses,
        removed: [...prev.diagnoses.removed, dxId],
      },
    }));
  }

  async removeProcedure(procId: string): Promise<void> {
    try {
      const response = await billingService.deleteBillingProcedure(procId);

      if (response.success) {
        this.updateBillingGroups((prev) =>
          prev.map((group) => ({
            ...group,
            procedures: group.procedures.filter((proc) => proc.id !== procId),
          }))
        );
      }
    } catch (err) {
      console.error("Error removing procedure:", err);
    }
  }

  async removeBillingGroup(groupId: string): Promise<void> {
    try {
      const response = await billingService.deleteBillingGroup(
        groupId,
        this.userId
      );

      if (response.success) {
        this.updateBillingGroups((prev) =>
          prev.filter((group) => group.id !== groupId)
        );
      }
    } catch (err) {
      console.error("Error removing billing group:", err);
    }
  }

  async createBillingGroup(encounterId: string): Promise<void> {
    const newGroupData: CreateBillingGroupData = {
      encounterId,
      procedureCode: "99203",
      procedureDescription: "New Patient Office Visit Level 3",
      modifiers: "",
    };

    try {
      const response = await billingService.createBillingGroup(
        this.userId,
        newGroupData
      );
      if (response.success && response.data) {
        this.updateBillingGroups((prev) => [...prev, response.data!]);
      }
    } catch (err) {
      console.error("Error creating billing group:", err);
    }
  }

  async createDiagnosis(
    diagnosisData: CreateBillingDiagnosisData
  ): Promise<boolean> {
    const tempId = `temp_dx_${Date.now()}`;

    const tempDiagnosis: BillingDiagnosis = {
      id: tempId,
      billingGroupId: diagnosisData.billingGroupId,
      icdCode: diagnosisData.icdCode,
      description: diagnosisData.description,
      isPrimary: diagnosisData.isPrimary || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.updateBillingGroups((prev) =>
      prev.map((group) =>
        group.id === diagnosisData.billingGroupId
          ? {
              ...group,
              diagnoses: [...group.diagnoses, tempDiagnosis],
            }
          : group
      )
    );

    this.updateLocalChanges((prev) => ({
      ...prev,
      diagnoses: {
        ...prev.diagnoses,
        added: [
          ...prev.diagnoses.added,
          { groupId: diagnosisData.billingGroupId, diagnosis: diagnosisData },
        ],
      },
    }));

    return true;
  }

  async saveAllChanges(localChanges: LocalChanges): Promise<void> {
    const procedurePromises = Object.entries(localChanges.procedureCodes).map(
      async ([groupId, data]: [
        string,
        { code: string; description: string }
      ]) => {
        await billingService.updateBillingGroup(groupId, this.userId, {
          procedureCode: data.code,
          procedureDescription: data.description,
        });
      }
    );

    const modifiersPromises = Object.entries(localChanges.modifiers).map(
      async ([groupId, value]: [string, string]) => {
        await billingService.updateBillingGroup(groupId, this.userId, {
          modifiers: value,
        });
      }
    );

    const diagnosisPromises = [
      ...localChanges.diagnoses.added.map(
        async (item: {
          groupId: string;
          diagnosis: CreateBillingDiagnosisData;
        }) => {
          await billingService.createBillingDiagnosis(
            this.userId,
            item.diagnosis
          );
        }
      ),
      ...localChanges.diagnoses.removed.map(async (dxId: string) => {
        await billingService.deleteBillingDiagnosis(dxId, this.userId);
      }),
      ...localChanges.diagnoses.primaryToggles.map(
        async (item: { dxId: string; groupId: string; isPrimary: boolean }) => {
          await billingService.updateBillingDiagnosis(item.dxId, this.userId, {
            isPrimary: item.isPrimary,
          });
        }
      ),
    ];

    const billingGroupPromises = [
      ...localChanges.billingGroups.added.map(
        async (groupData: CreateBillingGroupData) => {
          await billingService.createBillingGroup(this.userId, groupData);
        }
      ),
      ...localChanges.billingGroups.removed.map(async (groupId: string) => {
        await billingService.deleteBillingGroup(groupId, this.userId);
      }),
    ];

    await Promise.all([
      ...procedurePromises,
      ...modifiersPromises,
      ...diagnosisPromises,
      ...billingGroupPromises,
    ]);
  }
}
