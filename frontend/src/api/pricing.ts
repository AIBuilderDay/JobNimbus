import { PricingSchema, type Pricing, type PricingOverrides } from "../types/pricing";

export async function postPricing(estimateId: string): Promise<Pricing> {
  const res = await fetch(`/api/estimate/${estimateId}/pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to compute pricing: ${res.status}`);
  }
  const data = await res.json();
  const parsed = PricingSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Pricing response validation failed:", parsed.error);
    throw new Error("Invalid pricing response from server");
  }
  return parsed.data;
}

export async function putPricing(
  estimateId: string,
  overrides: PricingOverrides,
): Promise<Pricing> {
  const res = await fetch(`/api/estimate/${estimateId}/pricing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overrides),
  });
  if (!res.ok) {
    throw new Error(`Failed to update pricing: ${res.status}`);
  }
  const data = await res.json();
  const parsed = PricingSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Pricing response validation failed:", parsed.error);
    throw new Error("Invalid pricing response from server");
  }
  return parsed.data;
}
