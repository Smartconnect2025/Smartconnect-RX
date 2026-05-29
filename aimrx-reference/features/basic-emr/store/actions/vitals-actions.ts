import { vitalsService } from "../../services";
import { handleAsyncAction, updateItemInArray } from "../helpers";
import { VitalsActions } from "../types";

import type { StateCreator } from "zustand";
import type { EmrStore } from "../types";

export const createVitalsActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  VitalsActions
> = (set) => ({
  setVitals: (vitals) =>
    set((state) => {
      state.vitals = vitals;
    }),

  addVitals: (vitals) =>
    set((state) => {
      state.vitals.unshift(vitals);
    }),

  updateVitals: (updatedVitals) =>
    set((state) => {
      state.vitals = updateItemInArray(state.vitals, updatedVitals);
    }),

  fetchVitals: async (encounterId, userId) => {
    await handleAsyncAction(
      set,
      () => vitalsService.getVitals(encounterId, userId),
      (data) => {
        set((state) => {
          state.vitals = data;
        });
      }
    );
  },

  createVitals: async (userId, data) => {
    return await handleAsyncAction(
      set,
      () => vitalsService.createVitals(userId, data),
      (vitals) => {
        set((state) => {
          state.vitals.unshift(vitals);
        });
      },
      "Vitals created successfully"
    );
  },

  updateVitalsAsync: async (vitalsId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => vitalsService.updateVitalsAsync(vitalsId, userId, updates),
      (updatedVitals) => {
        set((state) => {
          state.vitals = updateItemInArray(state.vitals, updatedVitals);
        });
      },
      "Vitals updated successfully"
    );
  },
});
