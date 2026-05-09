import {
  BuildingInsightsSchema,
  type BuildingInsightsResponse,
} from "../types/solar";

interface StartEstimateResult {
  estimateId: string;
  location: { lat: number; lng: number };
  address: string;
  satelliteImageUrl: string | null;
  buildingInsights: BuildingInsightsResponse | null;
}

export async function startEstimate(
  address: string,
): Promise<StartEstimateResult> {
  const res = await fetch("/api/estimate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  if (res.status === 404) {
    throw new Error("Address not found. Please check and try again.");
  }
  if (!res.ok) {
    throw new Error(`Estimate request failed: ${res.status}`);
  }

  const data = await res.json();

  let buildingInsights: BuildingInsightsResponse | null = null;
  if (data.solar) {
    const parsed = BuildingInsightsSchema.safeParse(data.solar);
    if (parsed.success) {
      buildingInsights = parsed.data;
    } else {
      console.error("Solar response validation failed:", data.solar);
    }
  }

  return {
    estimateId: data.estimate_id,
    location: { lat: data.lat, lng: data.lng },
    address: data.address,
    satelliteImageUrl: data.satellite_image_url ?? null,
    buildingInsights,
  };
}
