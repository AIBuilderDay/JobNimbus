import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEstimatorStore } from "../store/estimatorStore";
import { saveDraft } from "../api/estimates";

const SYNC_INTERVAL_MS = 60_000;
const SYNC_VISUAL_MS = 1_200;

export function useAutoSync() {
  const setSyncStatus = useEstimatorStore((s) => s.setSyncStatus);
  const isSyncing = useEstimatorStore((s) => s.isSyncing);
  const lastSyncedAt = useEstimatorStore((s) => s.lastSyncedAt);
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncNow = useCallback(async () => {
    const state = useEstimatorStore.getState();
    if (!state.estimateId || !state.address) {
      return;
    }

    setSyncStatus(true);

    try {
      await saveDraft({
        estimate_id: state.estimateId,
        address: state.address,
        selected_segment_count: state.selectedSegmentIndices.length,
        total_segments: state.buildingInsights?.segments.length ?? 0,
        total_roof_area_sq_ft: state.buildingInsights?.total_roof_area_sq_ft ?? 0,
        material_name: state.selectedMaterialId,
        total_display: null,
        margin_display: null,
      });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    } catch (err) {
      console.error("Draft save failed:", err);
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSyncStatus(false, Date.now());
    }, SYNC_VISUAL_MS);
  }, [setSyncStatus, queryClient]);

  useEffect(() => {
    const id = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(timerRef.current);
    };
  }, [syncNow]);

  return { isSyncing, lastSyncedAt, syncNow };
}
