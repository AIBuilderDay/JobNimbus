import { useQuery } from "@tanstack/react-query";
import { fetchBenchmark } from "../api/benchmark";

export function useBenchmark(refresh = false) {
  return useQuery({
    queryKey: ["benchmark", refresh],
    queryFn: () => fetchBenchmark(refresh),
    staleTime: 5 * 60 * 1000,
  });
}
