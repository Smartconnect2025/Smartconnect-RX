import { useEmrStore } from "./emr-store";

export const usePatients = () => useEmrStore((state) => state.patients);
export const useCurrentPatient = () =>
  useEmrStore((state) => state.currentPatient);
export const useEncounters = () => useEmrStore((state) => state.encounters);
export const useCurrentEncounter = () =>
  useEmrStore((state) => state.currentEncounter);
export const useMedications = () => useEmrStore((state) => state.medications);
export const useConditions = () => useEmrStore((state) => state.conditions);
export const useAllergies = () => useEmrStore((state) => state.allergies);
export const useOrders = () => useEmrStore((state) => state.orders);
export const useAddendums = () => useEmrStore((state) => state.addendums);
export const useVitals = () => useEmrStore((state) => state.vitals);
export const useEmrLoading = () => useEmrStore((state) => state.loading);
export const useEmrError = () => useEmrStore((state) => state.error);

// Action Selectors
export const usePatientActions = () =>
  useEmrStore((state) => ({
    setPatients: state.setPatients,
    setCurrentPatient: state.setCurrentPatient,
    addPatient: state.addPatient,
    updatePatient: state.updatePatient,
    fetchPatients: state.fetchPatients,
    fetchPatientById: state.fetchPatientById,
    createPatient: state.createPatient,
    updatePatientAsync: state.updatePatientAsync,
  }));

export const useEncounterActions = () =>
  useEmrStore((state) => ({
    setEncounters: state.setEncounters,
    setCurrentEncounter: state.setCurrentEncounter,
    addEncounter: state.addEncounter,
    updateEncounter: state.updateEncounter,
    fetchEncounters: state.fetchEncounters,
    createEncounter: state.createEncounter,
    updateEncounterAsync: state.updateEncounterAsync,
  }));

export const useMedicationActions = () =>
  useEmrStore((state) => ({
    setMedications: state.setMedications,
    addMedication: state.addMedication,
    updateMedication: state.updateMedication,
    fetchMedications: state.fetchMedications,
    createMedication: state.createMedication,
    updateMedicationAsync: state.updateMedicationAsync,
  }));

export const useConditionActions = () =>
  useEmrStore((state) => ({
    setConditions: state.setConditions,
    addCondition: state.addCondition,
    updateCondition: state.updateCondition,
    fetchConditions: state.fetchConditions,
    createCondition: state.createCondition,
    updateConditionAsync: state.updateConditionAsync,
  }));

export const useAllergyActions = () =>
  useEmrStore((state) => ({
    setAllergies: state.setAllergies,
    addAllergy: state.addAllergy,
    updateAllergy: state.updateAllergy,
    fetchAllergies: state.fetchAllergies,
    createAllergy: state.createAllergy,
    updateAllergyAsync: state.updateAllergyAsync,
  }));

export const useOrderActions = () =>
  useEmrStore((state) => ({
    setOrders: state.setOrders,
    addOrder: state.addOrder,
    updateOrder: state.updateOrder,
    fetchOrders: state.fetchOrders,
    createOrder: state.createOrder,
    updateOrderAsync: state.updateOrderAsync,
  }));

export const useAddendumActions = () =>
  useEmrStore((state) => ({
    setAddendums: state.setAddendums,
    addAddendum: state.addAddendum,
    fetchAddendums: state.fetchAddendums,
    createAddendum: state.createAddendum,
  }));

export const useVitalsActions = () =>
  useEmrStore((state) => ({
    setVitals: state.setVitals,
    addVitals: state.addVitals,
    updateVitals: state.updateVitals,
    fetchVitals: state.fetchVitals,
    createVitals: state.createVitals,
    updateVitalsAsync: state.updateVitalsAsync,
  }));

export const useUtilityActions = () =>
  useEmrStore((state) => ({
    setLoading: state.setLoading,
    setError: state.setError,
    reset: state.reset,
  }));
