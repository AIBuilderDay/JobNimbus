import { useEffect, useCallback, useRef } from "react";
import { useEstimatorStore } from "../store/estimatorStore";

const SYNC_INTERVAL_MS = 60_000;
const SYNC_VISUAL_MS = 1_200;

export function useAutoSync() {
  const setSyncStatus = useEstimatorStore((s) => s.setSyncStatus);
  const isSyncing = useEstimatorStore((s) => s.isSyncing);
  const lastSyncedAt = useEstimatorStore((s) => s.lastSyncedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncNow = useCallback(() => {
    setSyncStatus(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSyncStatus(false, Date.now());
    }, SYNC_VISUAL_MS);
  }, [setSyncStatus]);

  useEffect(() => {
    const id = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(timerRef.current);
    };
  }, [syncNow]);

  return { isSyncing, lastSyncedAt, syncNow };
}
