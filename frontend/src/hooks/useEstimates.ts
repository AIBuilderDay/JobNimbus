import { useQuery } from "@tanstack/react-query";
import { fetchEstimates, fetchProperties, fetchLineItems, fetchCatalog, fetchMaterials } from "../api/estimates";
import type { EstimateStatus } from "../types/estimate";

export function useEstimates(filter: "all" | EstimateStatus = "all") {
  return useQuery({
    queryKey: ["estimates", filter],
    queryFn: () => fetchEstimates(filter),
    staleTime: 30_000,
  });
}

export function useProperties(query: string) {
  return useQuery({
    queryKey: ["properties", query],
    queryFn: () => fetchProperties(query),
    staleTime: 10_000,
  });
}

export function useLineItems(estimateId: string = "EST-2418") {
  return useQuery({
    queryKey: ["lineItems", estimateId],
    queryFn: () => fetchLineItems(estimateId),
    staleTime: 60_000,
  });
}

export function useCatalog(category?: string) {
  return useQuery({
    queryKey: ["catalog", category],
    queryFn: () => fetchCatalog(category),
    staleTime: 300_000,
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: fetchMaterials,
    staleTime: 300_000,
  });
}
