import { patientService } from "../../services";
import { handleAsyncAction, updateItemInArray } from "../helpers";
import { PatientActions } from "../types";

import type { StateCreator } from "zustand";
import type { EmrStore } from "../types";

export const createPatientActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never],
  ],
  [],
  PatientActions
> = (set) => ({
  setPatients: (patients) =>
    set((state) => {
      state.patients = patients;
    }),

  setCurrentPatient: (patient) =>
    set((state) => {
      state.currentPatient = patient;
    }),

  addPatient: (patient) =>
    set((state) => {
      state.patients.unshift(patient);
    }),

  updatePatient: (updatedPatient) =>
    set((state) => {
      state.patients = updateItemInArray(state.patients, updatedPatient);
      if (state.currentPatient?.id === updatedPatient.id) {
        state.currentPatient = updatedPatient;
      }
    }),

  fetchPatients: async (userId, searchQuery, page = 1, limit = 10) => {
    await handleAsyncAction(
      set,
      () => patientService.getPatients(userId, searchQuery, page, limit),
      (data) => {
        set((state) => {
          state.patients = data.patients;
        });
      },
    );
  },

  fetchPatientById: async (patientId, userId) => {
    return await handleAsyncAction(
      set,
      () => patientService.getPatientById(patientId, userId),
      (data) => {
        set((state) => {
          state.currentPatient = data;
        });
      },
    );
  },

  createPatient: async (userId, data) => {
    return await handleAsyncAction(
      set,
      async () => {
        const response = await fetch("/api/basic-emr/patients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create patient");
        }

        const result = await response.json();
        return result; // Return the full result object with success and data
      },
      (patient) => {
        set((state) => {
          state.patients.unshift(patient);
        });
      },
      "Patient created successfully",
    );
  },

  updatePatientAsync: async (patientId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => patientService.updatePatient(patientId, userId, updates),
      (updatedPatient) => {
        set((state) => {
          state.patients = updateItemInArray(state.patients, updatedPatient);
          if (state.currentPatient?.id === updatedPatient.id) {
            state.currentPatient = updatedPatient;
          }
        });
      },
      "Patient updated successfully",
    );
  },
});
