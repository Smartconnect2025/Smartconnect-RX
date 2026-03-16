import { StateCreator } from "zustand";
import { billingService } from "../../services/billingService";
import { handleAsyncAction, updateItemInArray } from "../helpers";
import { BillingActions, EmrStore } from "../types";
import {
  BillingDiagnosis,
  BillingGroup,
  BillingProcedure,
} from "../../types/billing.types";

export const createBillingActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  BillingActions
> = (set) => ({
  setBillingGroups: (billingGroups) => {
    set((state) => {
      state.billingGroups = billingGroups;
    });
  },

  addBillingGroup: (billingGroup) => {
    set((state) => {
      state.billingGroups.push(billingGroup);
    });
  },

  updateBillingGroup: (billingGroup) => {
    set((state) => {
      updateItemInArray(state.billingGroups, billingGroup);
    });
  },

  fetchBillingGroups: async (encounterId, userId) => {
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.getBillingGroups(
          encounterId,
          userId
        );
        if (response.success && response.data !== undefined) {
          set((state) => {
            state.billingGroups = response.data!;
          });
        }
        return response;
      },
      (data) => {
        set((state) => {
          state.billingGroups = data;
        });
      },
      "Failed to fetch billing groups"
    );
  },

  createBillingGroup: async (userId, data) => {
    let result: BillingGroup | null = null;
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.createBillingGroup(userId, data);
        if (response.success && response.data !== undefined) {
          set((state) => {
            state.billingGroups.push(response.data!);
          });
          result = response.data;
        }
        return response;
      },
      undefined,
      "Billing group created successfully"
    );
    return result;
  },

  updateBillingGroupAsync: async (billingGroupId, userId, updates) => {
    let result: BillingGroup | null = null;
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.updateBillingGroup(
          billingGroupId,
          userId,
          updates
        );
        if (response.success && response.data !== undefined) {
          set((state) => {
            updateItemInArray(state.billingGroups, response.data!);
          });
          result = response.data;
        }
        return response;
      },
      undefined,
      "Billing group updated successfully"
    );
    return result;
  },

  deleteBillingGroupAsync: async (billingGroupId, userId) => {
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.deleteBillingGroup(
          billingGroupId,
          userId
        );
        if (response.success) {
          set((state) => {
            state.billingGroups = state.billingGroups.filter(
              (group) => group.id !== billingGroupId
            );
          });
        }
        return response;
      },
      undefined,
      "Billing group deleted successfully"
    );
  },

  createBillingDiagnosis: async (userId, data) => {
    let result: BillingDiagnosis | null = null;
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.createBillingDiagnosis(
          userId,
          data
        );
        if (response.success && response.data !== undefined) {
          set((state) => {
            const billingGroup = state.billingGroups.find(
              (group) => group.id === data.billingGroupId
            );
            if (billingGroup) {
              billingGroup.diagnoses.push(response.data!);
            }
          });
          result = response.data;
        }
        return response;
      },
      undefined,
      "Diagnosis added successfully"
    );
    return result;
  },

  updateBillingDiagnosisAsync: async (diagnosisId, userId, updates) => {
    let result: BillingDiagnosis | null = null;
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.updateBillingDiagnosis(
          diagnosisId,
          userId,
          updates
        );
        if (response.success && response.data !== undefined) {
          set((state) => {
            state.billingGroups.forEach((group) => {
              const diagnosisIndex = group.diagnoses.findIndex(
                (dx) => dx.id === diagnosisId
              );
              if (diagnosisIndex !== -1) {
                group.diagnoses[diagnosisIndex] = response.data!;
              }
            });
          });
          result = response.data;
        }
        return response;
      },
      undefined,
      "Diagnosis updated successfully"
    );
    return result;
  },

  deleteBillingDiagnosisAsync: async (diagnosisId, userId) => {
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.deleteBillingDiagnosis(
          diagnosisId,
          userId
        );
        if (response.success) {
          set((state) => {
            state.billingGroups.forEach((group) => {
              group.diagnoses = group.diagnoses.filter(
                (dx) => dx.id !== diagnosisId
              );
            });
          });
        }
        return response;
      },
      undefined,
      "Diagnosis deleted successfully"
    );
  },

  createBillingProcedure: async (userId, data) => {
    let result: BillingProcedure | null = null;
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.createBillingProcedure(
          userId,
          data
        );
        if (response.success && response.data !== undefined) {
          set((state) => {
            const billingGroup = state.billingGroups.find(
              (group) => group.id === data.billingGroupId
            );
            if (billingGroup) {
              billingGroup.procedures.push(response.data!);
            }
          });
          result = response.data;
        }
        return response;
      },
      undefined,
      "Procedure added successfully"
    );
    return result;
  },

  updateBillingProcedureAsync: async (procedureId, userId, updates) => {
    let result: BillingProcedure | null = null;
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.updateBillingProcedure(
          procedureId,
          userId,
          updates
        );
        if (response.success && response.data !== undefined) {
          set((state) => {
            state.billingGroups.forEach((group) => {
              const procedureIndex = group.procedures.findIndex(
                (proc) => proc.id === procedureId
              );
              if (procedureIndex !== -1) {
                group.procedures[procedureIndex] = response.data!;
              }
            });
          });
          result = response.data;
        }
        return response;
      },
      undefined,
      "Procedure updated successfully"
    );
    return result;
  },

  deleteBillingProcedureAsync: async (procedureId) => {
    await handleAsyncAction(
      set,
      async () => {
        const response = await billingService.deleteBillingProcedure(
          procedureId
          // userId
        );
        if (response.success) {
          set((state) => {
            state.billingGroups.forEach((group) => {
              group.procedures = group.procedures.filter(
                (proc) => proc.id !== procedureId
              );
            });
          });
        }
        return response;
      },
      undefined,
      "Procedure deleted successfully"
    );
  },
});
