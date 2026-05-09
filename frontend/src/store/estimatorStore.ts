import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BuildingInsightsResponse } from "../types/solar";

type ModelStatus = "idle" | "pending" | "capturing" | "review" | "generating" | "completed" | "failed";

interface EstimatorState {
  location: { lat: number; lng: number } | null;
  address: string | null;
  satelliteImageUrl: string | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedSegmentIndex: number;
  estimateId: string | null;
  modelStatus: ModelStatus;
  modelUrl: string | null;
  modelError: string | null;

  setLocation: (loc: { lat: number; lng: number }, address: string) => void;
  setSatelliteImageUrl: (url: string | null) => void;
  setBuildingInsights: (data: BuildingInsightsResponse | null) => void;
  setSelectedSegmentIndex: (index: number) => void;
  setEstimateId: (id: string | null) => void;
  setModelStatus: (status: ModelStatus) => void;
  setModelUrl: (url: string | null) => void;
  setModelError: (error: string | null) => void;
  reset: () => void;
}

export const useEstimatorStore = create<EstimatorState>()(
  persist(
    (set) => ({
      location: null,
      address: null,
      satelliteImageUrl: null,
      buildingInsights: null,
      selectedSegmentIndex: -1,
      estimateId: null,
      modelStatus: "idle" as ModelStatus,
      modelUrl: null,
      modelError: null,

      setLocation: (loc, address) => set({ location: loc, address }),
      setSatelliteImageUrl: (url) => set({ satelliteImageUrl: url }),
      setBuildingInsights: (data) => set({ buildingInsights: data }),
      setSelectedSegmentIndex: (index) => set({ selectedSegmentIndex: index }),
      setEstimateId: (id) => set({
        estimateId: id,
        modelStatus: id ? ("pending" as ModelStatus) : ("idle" as ModelStatus),
        modelUrl: null,
        modelError: null,
      }),
      setModelStatus: (status) => set({ modelStatus: status }),
      setModelUrl: (url) => set({ modelUrl: url }),
      setModelError: (error) => set({ modelError: error }),
      reset: () =>
        set({
          location: null,
          address: null,
          satelliteImageUrl: null,
          buildingInsights: null,
          selectedSegmentIndex: -1,
          estimateId: null,
          modelStatus: "idle" as ModelStatus,
          modelUrl: null,
          modelError: null,
        }),
    }),
    {
      name: "estimator-state",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
