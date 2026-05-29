import { initialState } from "../helpers";
import { UtilityActions } from "../types";

import type { StateCreator } from "zustand";
import type { EmrStore } from "../types";

export const createUtilityActions: StateCreator<
  EmrStore,
  [
    ["zustand/immer", never],
    ["zustand/devtools", never],
    ["zustand/subscribeWithSelector", never]
  ],
  [],
  UtilityActions
> = (set) => ({
  setLoading: (loading) =>
    set((state) => {
      state.loading = loading;
    }),

  setError: (error) =>
    set((state) => {
      state.error = error;
    }),

  reset: () =>
    set((state) => {
      Object.assign(state, initialState);
    }),
});
