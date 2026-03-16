"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";

import type { EmrStore } from "./types";
import { initialState } from "./helpers";
import { createPatientActions } from "./actions/patient-actions";
import { createEncounterActions } from "./actions/encounter-actions";
import {
  createMedicationActions,
  createConditionActions,
  createAllergyActions,
  createOrderActions,
  createAddendumActions,
} from "./actions/medical-data-actions";
import { createVitalsActions } from "./actions/vitals-actions";
import { createBillingActions } from "./actions/billing-actions";
import { createUtilityActions } from "./actions/utility-actions";

// Store implementation
export const useEmrStore = create<EmrStore>()(
  devtools(
    immer((set, get, api) => ({
      // Initial state
      ...initialState,

      // Compose all action creators  
      ...createPatientActions(set, get, api),
      ...createEncounterActions(set, get, api),
      ...createMedicationActions(set, get, api),
      ...createConditionActions(set, get, api),
      ...createAllergyActions(set, get, api),
      ...createOrderActions(set, get, api),
      ...createAddendumActions(set, get, api),
      ...createVitalsActions(set, get, api),
      ...createBillingActions(set, get, api),
      ...createUtilityActions(set, get, api),
    })),
    { name: "emr-store" }
  )
);
