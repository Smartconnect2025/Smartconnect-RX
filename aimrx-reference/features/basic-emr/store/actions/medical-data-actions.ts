import {
  addendumService,
  allergyService,
  conditionService,
  medicationService,
  orderService,
} from "../../services";
import { handleAsyncAction, updateItemInArray } from "../helpers";
import {
  AddendumActions,
  AllergyActions,
  ConditionActions,
  MedicationActions,
  OrderActions,
} from "../types";

import type { StateCreator } from "zustand";
import type { EmrStore } from "../types";

export const createMedicationActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  MedicationActions
> = (set) => ({
  setMedications: (medications) =>
    set((state) => {
      state.medications = medications;
    }),

  addMedication: (medication) =>
    set((state) => {
      state.medications.unshift(medication);
    }),

  updateMedication: (updatedMedication) =>
    set((state) => {
      state.medications = updateItemInArray(
        state.medications,
        updatedMedication
      );
    }),

  fetchMedications: async (patientId, userId) => {
    await handleAsyncAction(
      set,
      () => medicationService.getMedications(patientId, userId),
      (data) => {
        set((state) => {
          state.medications = data;
        });
      }
    );
  },

  createMedication: async (userId, data) => {
    return await handleAsyncAction(
      set,
      () => medicationService.createMedication(userId, data),
      (medication) => {
        set((state) => {
          state.medications.unshift(medication);
        });
      },
      "Medication created successfully"
    );
  },

  updateMedicationAsync: async (medicationId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => medicationService.updateMedication(medicationId, userId, updates),
      (updatedMedication) => {
        set((state) => {
          state.medications = updateItemInArray(
            state.medications,
            updatedMedication
          );
        });
      },
      "Medication updated successfully"
    );
  },
});

export const createConditionActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  ConditionActions
> = (set) => ({
  setConditions: (conditions) =>
    set((state) => {
      state.conditions = conditions;
    }),

  addCondition: (condition) =>
    set((state) => {
      state.conditions.unshift(condition);
    }),

  updateCondition: (updatedCondition) =>
    set((state) => {
      state.conditions = updateItemInArray(state.conditions, updatedCondition);
    }),

  fetchConditions: async (patientId, userId) => {
    await handleAsyncAction(
      set,
      () => conditionService.getConditions(patientId, userId),
      (data) => {
        set((state) => {
          state.conditions = data;
        });
      }
    );
  },

  createCondition: async (userId, data) => {
    return await handleAsyncAction(
      set,
      () => conditionService.createCondition(userId, data),
      (condition) => {
        set((state) => {
          state.conditions.unshift(condition);
        });
      },
      "Condition created successfully"
    );
  },

  updateConditionAsync: async (conditionId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => conditionService.updateCondition(conditionId, userId, updates),
      (updatedCondition) => {
        set((state) => {
          state.conditions = updateItemInArray(
            state.conditions,
            updatedCondition
          );
        });
      },
      "Condition updated successfully"
    );
  },
});

export const createAllergyActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  AllergyActions
> = (set) => ({
  setAllergies: (allergies) =>
    set((state) => {
      state.allergies = allergies;
    }),

  addAllergy: (allergy) =>
    set((state) => {
      state.allergies.unshift(allergy);
    }),

  updateAllergy: (updatedAllergy) =>
    set((state) => {
      state.allergies = updateItemInArray(state.allergies, updatedAllergy);
    }),

  fetchAllergies: async (patientId, userId) => {
    await handleAsyncAction(
      set,
      () => allergyService.getAllergies(patientId, userId),
      (data) => {
        set((state) => {
          state.allergies = data;
        });
      }
    );
  },

  createAllergy: async (userId, data) => {
    return await handleAsyncAction(
      set,
      () => allergyService.createAllergy(userId, data),
      (allergy) => {
        set((state) => {
          state.allergies.unshift(allergy);
        });
      },
      "Allergy created successfully"
    );
  },

  updateAllergyAsync: async (allergyId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => allergyService.updateAllergy(allergyId, userId, updates),
      (updatedAllergy) => {
        set((state) => {
          state.allergies = updateItemInArray(state.allergies, updatedAllergy);
        });
      },
      "Allergy updated successfully"
    );
  },
});

export const createOrderActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  OrderActions
> = (set) => ({
  setOrders: (orders) =>
    set((state) => {
      state.orders = orders;
    }),

  addOrder: (order) =>
    set((state) => {
      state.orders.unshift(order);
    }),

  updateOrder: (updatedOrder) =>
    set((state) => {
      state.orders = updateItemInArray(state.orders, updatedOrder);
    }),

  fetchOrders: async (encounterId, userId) => {
    await handleAsyncAction(
      set,
      () => orderService.getOrders(encounterId, userId),
      (data) => {
        set((state) => {
          state.orders = data;
        });
      }
    );
  },

  createOrder: async (userId, data) => {
    return await handleAsyncAction(
      set,
      () => orderService.createOrder(userId, data),
      (order) => {
        set((state) => {
          state.orders.unshift(order);
        });
      },
      "Order created successfully"
    );
  },

  updateOrderAsync: async (orderId, userId, updates) => {
    return await handleAsyncAction(
      set,
      () => orderService.updateOrder(orderId, userId, updates),
      (updatedOrder) => {
        set((state) => {
          state.orders = updateItemInArray(state.orders, updatedOrder);
        });
      },
      "Order updated successfully"
    );
  },
});

export const createAddendumActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  AddendumActions
> = (set) => ({
  setAddendums: (addendums) =>
    set((state) => {
      state.addendums = addendums;
    }),

  addAddendum: (addendum) =>
    set((state) => {
      state.addendums.unshift(addendum);
    }),

  fetchAddendums: async (encounterId, userId) => {
    await handleAsyncAction(
      set,
      () => addendumService.getAddendums(encounterId, userId),
      (addendums) => {
        set((state) => {
          state.addendums = addendums;
        });
      }
    );
  },

  createAddendum: async (userId, encounterId, content) => {
    return await handleAsyncAction(
      set,
      () =>
        addendumService.createAddendum(userId, encounterId, content),
      (addendum) => {
        set((state) => {
          state.addendums.unshift(addendum);
        });
      },
      "Addendum created successfully"
    );
  },
});
