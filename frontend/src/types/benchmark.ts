import { z } from "zod";

const BenchmarkResultSchema = z.object({
  address: z.string(),
  pitch: z.string(),
  reference_a_sqft: z.number(),
  reference_b_sqft: z.number(),
  measured_sqft: z.number(),
  error_vs_a_pct: z.number(),
  error_vs_b_pct: z.number(),
  best_error_pct: z.number(),
  passed: z.boolean(),
  imagery_quality: z.string(),
  segments: z.number().int(),
  status: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const BenchmarkResultsSchema = z.object({
  tolerance_pct: z.number(),
  pass_threshold: z.number().int(),
  total: z.number().int(),
  pass_count: z.number().int(),
  qualified: z.boolean(),
  results: z.array(BenchmarkResultSchema),
});

export type BenchmarkResults = z.infer<typeof BenchmarkResultsSchema>;
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
