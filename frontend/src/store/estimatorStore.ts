import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BuildingInsightsResponse } from "../types/solar";

interface EstimatorState {
  location: { lat: number; lng: number } | null;
  address: string | null;
  satelliteImageUrl: string | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedSegmentIndices: number[];
  estimateId: string | null;
  selectedMaterialId: string | null;

  setLocation: (loc: { lat: number; lng: number }, address: string) => void;
  setSatelliteImageUrl: (url: string | null) => void;
  setBuildingInsights: (data: BuildingInsightsResponse | null) => void;
  toggleSegmentIndex: (index: number) => void;
  selectAllSegments: () => void;
  clearSelectedSegments: () => void;
  setEstimateId: (id: string | null) => void;
  setSelectedMaterialId: (id: string | null) => void;
  setSegmentPolygons: (polygons: { segment_id: number; polygon: number[][] }[]) => void;
  reset: () => void;
}

export const useEstimatorStore = create<EstimatorState>()(
  persist(
    (set) => ({
      location: null,
      address: null,
      satelliteImageUrl: null,
      buildingInsights: null,
      selectedSegmentIndices: [],
      estimateId: null,
      selectedMaterialId: null,

      setLocation: (loc, address) => set({ location: loc, address }),
      setSatelliteImageUrl: (url) => set({ satelliteImageUrl: url }),
      setBuildingInsights: (data) => set({ buildingInsights: data }),
      toggleSegmentIndex: (index) =>
        set((state) => {
          const has = state.selectedSegmentIndices.includes(index);
          return {
            selectedSegmentIndices: has
              ? state.selectedSegmentIndices.filter((i) => i !== index)
              : [...state.selectedSegmentIndices, index],
          };
        }),
      selectAllSegments: () =>
        set((state) => ({
          selectedSegmentIndices: state.buildingInsights
            ? state.buildingInsights.segments.map((_, i) => i)
            : [],
        })),
      clearSelectedSegments: () => set({ selectedSegmentIndices: [] }),
      setEstimateId: (id) => set({ estimateId: id }),
      setSelectedMaterialId: (id) => set({ selectedMaterialId: id }),
      setSegmentPolygons: (polygons) =>
        set((state) => {
          if (!state.buildingInsights) return {};
          const segments = state.buildingInsights.segments.map((seg) => {
            const match = polygons.find((p) => p.segment_id === seg.id);
            return match ? { ...seg, polygon: match.polygon } : seg;
          });
          return {
            buildingInsights: { ...state.buildingInsights, segments },
          };
        }),
      reset: () =>
        set({
          location: null,
          address: null,
          satelliteImageUrl: null,
          buildingInsights: null,
          selectedSegmentIndices: [],
          estimateId: null,
          selectedMaterialId: null,
        }),
    }),
    {
      name: "estimator-state",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
