import { toast } from "sonner";

import { EmrState } from "./types";

export const initialState: EmrState = {
  patients: [],
  currentPatient: null,
  encounters: [],
  currentEncounter: null,
  medications: [],
  conditions: [],
  allergies: [],
  orders: [],
  addendums: [],
  vitals: [],
  billingGroups: [],
  loading: false,
  error: null,
};

export const handleAsyncAction = async <T>(
  set: (fn: (state: EmrState) => void) => void,
  action: () => Promise<{ success: boolean; data?: T; error?: string }>,
  onSuccess?: (data: T) => void,
  successMessage?: string
): Promise<T | null> => {
  try {
    set((state) => {
      state.loading = true;
      state.error = null;
    });

    const result = await action();

    if (result.success && result.data !== undefined) {
      if (onSuccess) {
        onSuccess(result.data);
      }

      if (successMessage) {
        toast.success(successMessage);
      }

      set((state) => {
        state.loading = false;
      });

      return result.data;
    } else {
      throw new Error(result.error || "Operation failed");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";

    set((state) => {
      state.loading = false;
      state.error = errorMessage;
    });

    toast.error(errorMessage);
    return null;
  }
};

export const updateItemInArray = <T extends { id: string }>(
  array: T[],
  updatedItem: T
): T[] => {
  return array.map((item) => (item.id === updatedItem.id ? updatedItem : item));
};
