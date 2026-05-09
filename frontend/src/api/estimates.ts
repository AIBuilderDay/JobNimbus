import { estimates, statusCounts, properties, lineItems } from "../data/estimates";
import type { Estimate, EstimateStatus, Property, LineItem } from "../types/estimate";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchEstimates(
  filter: "all" | EstimateStatus = "all",
): Promise<{ estimates: Estimate[]; counts: typeof statusCounts; total: number }> {
  await delay(200);
  const filtered =
    filter === "all"
      ? estimates
      : estimates.filter((e) => e.status === filter);
  return { estimates: filtered, counts: statusCounts, total: 28 };
}

export async function fetchProperties(
  query: string,
): Promise<Property[]> {
  await delay(150);
  if (!query)
    return properties;
  return properties.filter(
    (p) =>
      `${p.line1} ${p.line2}`.toLowerCase().includes(query.toLowerCase()),
  );
}

export async function fetchLineItems(): Promise<LineItem[]> {
  await delay(100);
  return lineItems;
}
