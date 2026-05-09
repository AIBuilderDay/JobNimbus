import { useQuery } from "@tanstack/react-query";
import { fetchEstimates, fetchProperties, fetchLineItems } from "../api/estimates";
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

export function useLineItems() {
  return useQuery({
    queryKey: ["lineItems"],
    queryFn: fetchLineItems,
    staleTime: 60_000,
  });
}
