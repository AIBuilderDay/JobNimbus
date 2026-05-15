import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BuildingInsightsResponse } from "../types/solar";

export interface PricingState {
  activeTab: number;
  marginPct: number;
  toggles: boolean[];
  financing: number;
}

export interface ProposalState {
  customerName: string;
  coverNote: string;
  recipient: string;
  cc: string;
  tone: number;
  toggles: boolean[];
  previewTab: number;
}

const DEFAULT_PRICING: PricingState = {
  activeTab: 0,
  marginPct: 38,
  toggles: [true, true, false],
  financing: 0,
};

function defaultCoverNote(name: string, address: string): string {
  return `Hi ${name},\n\nThank you for the opportunity to inspect your roof at ${address}. After our drone survey and on-site assessment, we recommend a full re-roof using GAF Duration Estate Gray shingles.\n\nThe enclosed proposal covers all materials, labor, disposal, and permits. We've included two financing options for your convenience.\n\nWe'd love to get you on the schedule before the rainy season. Feel free to reach out with any questions.\n\nBest regards,\nTeam Nimbus Quote`;
}

const DEFAULT_PROPOSAL: ProposalState = {
  customerName: "McKay Snell",
  coverNote: defaultCoverNote("McKay", "your property"),
  recipient: "mckayqsnell@gmail.com",
  cc: "",
  tone: 1,
  toggles: [true, true, true, false],
  previewTab: 0,
};

interface EstimatorState {
  location: { lat: number; lng: number } | null;
  address: string | null;
  satelliteImageUrl: string | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedSegmentIndices: number[];
  estimateId: string | null;
  selectedMaterialId: string | null;

  pricingState: PricingState;
  proposalState: ProposalState;
  lastProposalPdfBase64: string | null;
  lastSyncedAt: number | null;
  isSyncing: boolean;

  setLocation: (loc: { lat: number; lng: number }, address: string) => void;
  setSatelliteImageUrl: (url: string | null) => void;
  setBuildingInsights: (data: BuildingInsightsResponse | null) => void;
  toggleSegmentIndex: (index: number) => void;
  selectAllSegments: () => void;
  clearSelectedSegments: () => void;
  setEstimateId: (id: string | null) => void;
  setSelectedMaterialId: (id: string | null) => void;
  setSegmentPolygons: (polygons: { segment_id: number; polygon: number[][] }[]) => void;
  setPricingState: (patch: Partial<PricingState>) => void;
  setProposalState: (patch: Partial<ProposalState>) => void;
  setLastProposalPdfBase64: (base64: string | null) => void;
  setSyncStatus: (syncing: boolean, syncedAt?: number) => void;
  reset: () => void;
  getMaxAllowedStep: () => number;
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
      pricingState: DEFAULT_PRICING,
      proposalState: DEFAULT_PROPOSAL,
      lastProposalPdfBase64: null,
      lastSyncedAt: null,
      isSyncing: false,

      setLocation: (loc, address) =>
        set((state) => ({
          location: loc,
          address,
          proposalState: {
            ...state.proposalState,
            coverNote: defaultCoverNote(state.proposalState.customerName, address),
          },
        })),
      setSatelliteImageUrl: (url) => set({ satelliteImageUrl: url }),
      setBuildingInsights: (data) => {
        if (data) {
          const segments = data.segments.map((seg, i) => ({
            ...seg,
            uid: seg.uid ?? `seg-${crypto.randomUUID().slice(0, 8)}-${i}`,
          }));
          set({ buildingInsights: { ...data, segments } });
        } else {
          set({ buildingInsights: null });
        }
      },
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
      setPricingState: (patch) =>
        set((state) => ({ pricingState: { ...state.pricingState, ...patch } })),
      setProposalState: (patch) =>
        set((state) => ({ proposalState: { ...state.proposalState, ...patch } })),
      setLastProposalPdfBase64: (base64) => set({ lastProposalPdfBase64: base64 }),
      setSyncStatus: (syncing, syncedAt) =>
        set({ isSyncing: syncing, ...(syncedAt != null ? { lastSyncedAt: syncedAt } : {}) }),
      getMaxAllowedStep: () => {
        const state = useEstimatorStore.getState();
        if (!state.address || !state.buildingInsights) return 1;
        if (state.selectedSegmentIndices.length === 0 || !state.selectedMaterialId) return 2;
        return 5;
      },
      reset: () =>
        set({
          location: null,
          address: null,
          satelliteImageUrl: null,
          buildingInsights: null,
          selectedSegmentIndices: [],
          estimateId: null,
          selectedMaterialId: null,
          pricingState: DEFAULT_PRICING,
          proposalState: DEFAULT_PROPOSAL,
          lastProposalPdfBase64: null,
          lastSyncedAt: null,
          isSyncing: false,
        }),
    }),
    {
      name: "estimator-state",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const { isSyncing, lastProposalPdfBase64, ...rest } = state;
        void isSyncing;
        void lastProposalPdfBase64;
        return rest;
      },
    },
  ),
);
