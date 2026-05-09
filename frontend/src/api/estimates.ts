import type { Estimate, EstimateStatus, Property, LineItem, CatalogItem } from "../types/estimate";

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
): Promise<{ estimates: Estimate[]; counts: Record<string, number>; total: number }> {
  const params = new URLSearchParams({ status: filter });
  const res = await fetch(`/api/listings?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch estimates: ${res.status}`);
  }
  const data = await res.json();
  return {
    ...data,
    estimates: data.estimates.map((e: Record<string, unknown>) => ({
      ...e,
      cityState: e.city_state,
      sqFt: e.sq_ft,
      updatedSub: e.updated_sub,
      staleDays: e.stale_days,
    })),
  };
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

export async function fetchLineItems(estimateId: string = "EST-2418"): Promise<LineItem[]> {
  const res = await fetch(`/api/listings/${estimateId}/line-items`);
  if (!res.ok) {
    throw new Error(`Failed to fetch line items: ${res.status}`);
  }
  const data = await res.json();
  return data.map((item: Record<string, string>) => ({
    ...item,
    unitPrice: item.unit_price,
  }));
}

export async function fetchCatalog(category?: string): Promise<CatalogItem[]> {
  const params = category ? new URLSearchParams({ category }) : "";
  const res = await fetch(`/api/catalog${params ? `?${params}` : ""}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: ${res.status}`);
  }
  const data = await res.json();
  return data.map((item: Record<string, unknown>) => ({
    ...item,
    defaultUnit: item.default_unit,
    defaultUnitPrice: item.default_unit_price,
  }));
}

export interface MaterialCard {
  id: string;
  name: string;
  sub: string;
  price: string;
  pricePerSf: number;
  swatch: string;
}

export type MaterialTab = "shingle" | "metal" | "membrane";

export async function fetchMaterials(): Promise<Record<MaterialTab, MaterialCard[]>> {
  const res = await fetch("/api/catalog/materials");
  if (!res.ok) {
    throw new Error(`Failed to fetch materials: ${res.status}`);
  }
  return res.json();
}
