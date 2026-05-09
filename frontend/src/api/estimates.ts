import { estimates, statusCounts, lineItems } from "../data/estimates";
import type { Estimate, EstimateStatus, Property, LineItem } from "../types/estimate";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BackendEstimate {
  estimate_id: string;
  address: string;
  lat: number;
  lng: number;
  satellite_image_url: string;
  solar: {
    name: string;
    imagery_quality: string;
    segments: Array<Record<string, unknown>>;
    total_roof_area_sq_ft: number;
  } | null;
  total: { low: number; high: number };
  breakdown: unknown[];
  confidence_range: unknown;
}

export async function startEstimate(address: string): Promise<BackendEstimate> {
  const res = await fetch("/api/estimate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) {
    throw new Error(`Failed to start estimate: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

interface AerialOrientationPair {
  landscapeUri?: string;
  portraitUri?: string;
}

export interface AerialVideoResponse {
  state: "ACTIVE" | "PROCESSING";
  uris?: {
    IMAGE?: AerialOrientationPair;
    MP4_HIGH?: AerialOrientationPair;
    MP4_MEDIUM?: AerialOrientationPair;
    MP4_LOW?: AerialOrientationPair;
    DASH?: AerialOrientationPair;
    HLS?: AerialOrientationPair;
  };
  metadata?: {
    videoId?: string;
    address?: string;
    duration?: string;
    captureDate?: { year?: number; month?: number; day?: number };
  };
}

export async function fetchAerialVideo(address: string): Promise<AerialVideoResponse> {
  const params = new URLSearchParams({ address });
  const res = await fetch(`/api/aerial?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch aerial video: ${res.status}`);
  }
  return res.json();
}

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
  if (!query.trim()) return [];

  const params = new URLSearchParams({ q: query });
  const res = await fetch(`/api/places/autocomplete?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch places: ${res.status}`);
  }

  const suggestions: Array<{
    place_id: string;
    main_text: string;
    secondary_text: string;
    full_text: string;
  }> = await res.json();

  return suggestions.map((s, i) => ({
    id: i,
    line1: s.main_text,
    line2: s.secondary_text,
    parcel: s.place_id,
    tag: null,
    tagLabel: null,
  }));
}

export async function fetchLineItems(): Promise<LineItem[]> {
  await delay(100);
  return lineItems;
}
