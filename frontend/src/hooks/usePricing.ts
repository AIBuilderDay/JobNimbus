import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postPricing, putPricing } from "../api/pricing";
import type { PricingOverrides } from "../types/pricing";

export function usePricing(estimateId: string | null) {
  return useQuery({
    queryKey: ["pricing", estimateId],
    queryFn: () => postPricing(estimateId!),
    enabled: !!estimateId,
    staleTime: 30_000,
  });
}

export function useUpdatePricing(estimateId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (overrides: PricingOverrides) => putPricing(estimateId!, overrides),
    onSuccess: (data) => {
      qc.setQueryData(["pricing", estimateId], data);
    },
  });
}
