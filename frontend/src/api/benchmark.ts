import { BenchmarkResultsSchema, type BenchmarkResults } from "../types/benchmark";

export async function fetchBenchmark(refresh = false): Promise<BenchmarkResults> {
  const params = refresh ? "?refresh=true" : "";
  const res = await fetch(`/api/benchmark/results${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch benchmark results: ${res.status}`);
  }
  const data = await res.json();
  const parsed = BenchmarkResultsSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Benchmark response validation failed:", parsed.error);
    throw new Error("Invalid benchmark response from server");
  }
  return parsed.data;
}
