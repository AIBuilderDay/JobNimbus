import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BuildingInsightsResponse } from "../types/solar";

interface EstimatorState {
  location: { lat: number; lng: number } | null;
  address: string | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedSegmentIndices: number[];

  setLocation: (loc: { lat: number; lng: number }, address: string) => void;
  setBuildingInsights: (data: BuildingInsightsResponse | null) => void;
  toggleSegmentSelection: (index: number) => void;
  setSegmentSelection: (indices: number[]) => void;
  clearSegmentSelection: () => void;
  reset: () => void;
}

export const useEstimatorStore = create<EstimatorState>()(
  persist(
    (set) => ({
      location: null,
      address: null,
      buildingInsights: null,
      selectedSegmentIndices: [],

      setLocation: (loc, address) => set({ location: loc, address }),
      setBuildingInsights: (data) => set({ buildingInsights: data }),
      toggleSegmentSelection: (index) =>
        set((state) => {
          const exists = state.selectedSegmentIndices.includes(index);
          return {
            selectedSegmentIndices: exists
              ? state.selectedSegmentIndices.filter((i) => i !== index)
              : [...state.selectedSegmentIndices, index],
          };
        }),
      setSegmentSelection: (indices) => set({ selectedSegmentIndices: indices }),
      clearSegmentSelection: () => set({ selectedSegmentIndices: [] }),
      reset: () =>
        set({
          location: null,
          address: null,
          buildingInsights: null,
          selectedSegmentIndices: [],
        }),
    }),
    {
      name: "estimator-state",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
