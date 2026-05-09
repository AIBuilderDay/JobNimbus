import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BuildingInsightsResponse } from "../types/solar";

interface EstimatorState {
  location: { lat: number; lng: number } | null;
  address: string | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedSegmentIndex: number;

  setLocation: (loc: { lat: number; lng: number }, address: string) => void;
  setBuildingInsights: (data: BuildingInsightsResponse | null) => void;
  setSelectedSegmentIndex: (index: number) => void;
  reset: () => void;
}

export const useEstimatorStore = create<EstimatorState>()(
  persist(
    (set) => ({
      location: null,
      address: null,
      buildingInsights: null,
      selectedSegmentIndex: -1,

      setLocation: (loc, address) => set({ location: loc, address }),
      setBuildingInsights: (data) => set({ buildingInsights: data }),
      setSelectedSegmentIndex: (index) => set({ selectedSegmentIndex: index }),
      reset: () =>
        set({
          location: null,
          address: null,
          buildingInsights: null,
          selectedSegmentIndex: -1,
        }),
    }),
    {
      name: "estimator-state",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
