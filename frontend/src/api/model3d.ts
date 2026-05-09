export interface ModelStatus {
  estimate_id: string;
  status: "pending" | "capturing" | "review" | "generating" | "completed" | "failed";
  error: string | null;
}

export interface CaptureResponse {
  estimate_id: string;
  images: string[];
}

export async function generateModel(
  estimateId: string,
  lat: number,
  lng: number,
): Promise<ModelStatus> {
  const res = await fetch("/api/model3d/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estimate_id: estimateId, lat, lng }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Generate failed: ${res.status}`);
  }
  return res.json();
}

export async function captureImages(
  estimateId: string,
  lat: number,
  lng: number,
): Promise<CaptureResponse> {
  const res = await fetch("/api/model3d/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estimate_id: estimateId, lat, lng }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? `Capture failed: ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

export async function confirmGeneration(
  estimateId: string,
  selectedIndices: number[],
): Promise<ModelStatus> {
  const res = await fetch("/api/model3d/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estimate_id: estimateId, selected_indices: selectedIndices }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? `Confirm failed: ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

export async function pollModelStatus(
  estimateId: string,
): Promise<ModelStatus> {
  const res = await fetch(`/api/model3d/${estimateId}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export function getModelUrl(estimateId: string): string {
  return `/api/model3d/${estimateId}/model.glb`;
}
