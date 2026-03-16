import { encounterService } from "../../services";
import { handleAsyncAction, updateItemInArray } from "../helpers";
import { EncounterActions } from "../types";

import type { StateCreator } from "zustand";
import type { EmrStore } from "../types";

export const createEncounterActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  EncounterActions
> = (set) => ({
  setEncounters: (encounters) =>
    set((state) => {
      state.encounters = encounters;
    }),

  setCurrentEncounter: (encounter) =>
    set((state) => {
      state.currentEncounter = encounter;
    }),

  addEncounter: (encounter) =>
    set((state) => {
      state.encounters.unshift(encounter);
    }),

  updateEncounter: (updatedEncounter) =>
    set((state) => {
      state.encounters = updateItemInArray(state.encounters, updatedEncounter);
      if (state.currentEncounter?.id === updatedEncounter.id) {
        state.currentEncounter = updatedEncounter;
      }
    }),

  fetchEncounters: async (patientId, userId) => {
    await handleAsyncAction(
      set,
      () => encounterService.getEncounters(patientId, userId),
      (data) => {
        set((state) => {
          state.encounters = data;
        });
      }
    );
  },

  createEncounter: async (userId, data) => {
    return await handleAsyncAction(
      set,
      () => encounterService.createEncounter(userId, data),
      (encounter) => {
        set((state) => {
          state.encounters.unshift(encounter);
        });
      },
      "Encounter created successfully"
    );
  },

  updateEncounterAsync: async (encounterId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => encounterService.updateEncounter(encounterId, userId, updates),
      (updatedEncounter) => {
        set((state) => {
          state.encounters = updateItemInArray(
            state.encounters,
            updatedEncounter
          );
          if (state.currentEncounter?.id === updatedEncounter.id) {
            state.currentEncounter = updatedEncounter;
          }
        });
      },
      "Encounter updated successfully"
    );
  },

  deleteEncounterAsync: async (encounterId, userId) => {
    await handleAsyncAction(
      set,
      () => encounterService.deleteEncounter(encounterId, userId),
      () => {
        set((state) => {
          state.encounters = state.encounters.filter(
            (encounter) => encounter.id !== encounterId
          );
          if (state.currentEncounter?.id === encounterId) {
            state.currentEncounter = null;
          }
        });
      },
      "Encounter deleted successfully"
    );
    return;
  },
});
