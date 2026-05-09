import {
  BuildingInsightsSchema,
  type BuildingInsightsResponse,
} from "../types/solar";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

function cacheKey(lat: number, lng: number): string {
  return `solar:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function fetchBuildingInsights(
  lat: number,
  lng: number
): Promise<BuildingInsightsResponse> {
  const key = cacheKey(lat, lng);
  const cached = sessionStorage.getItem(key);
  if (cached) {
    return BuildingInsightsSchema.parse(JSON.parse(cached));
  }

  const url = new URL(
    "https://solar.googleapis.com/v1/buildingInsights:findClosest"
  );
  url.searchParams.set("location.latitude", lat.toString());
  url.searchParams.set("location.longitude", lng.toString());
  url.searchParams.set("requiredQuality", "HIGH");
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url.toString());

  if (res.status === 404) {
    throw new Error(
      "No solar data available for this building. Try a different address."
    );
  }
  if (!res.ok) {
    throw new Error(`Solar API error: ${res.status}`);
  }

  const raw = await res.json();

  const parsed = BuildingInsightsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Solar API response validation failed:", raw);
    throw new Error("Unexpected API response format.");
  }

  sessionStorage.setItem(key, JSON.stringify(parsed.data));
  return parsed.data;
}
