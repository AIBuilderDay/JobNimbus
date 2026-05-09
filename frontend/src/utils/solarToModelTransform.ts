import { Box3, Vector3, Raycaster, Object3D } from "three";
import type { RoofSegment } from "../types/solar";

const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 110540;

function metersPerDegLng(latDeg: number): number {
  return 111320 * Math.cos(latDeg * DEG_TO_RAD);
}

function segmentToPolygon(seg: RoofSegment): [number, number, number][] | null {
  if (seg.polygon && seg.polygon.length >= 3) {
    return seg.polygon as [number, number, number][];
  }
  if (!seg.bounding_box) return null;
  const { sw, ne } = seg.bounding_box;
  const elev = seg.plane_height_meters ?? 0;
  return [
    [sw.longitude, sw.latitude, elev],
    [ne.longitude, sw.latitude, elev],
    [ne.longitude, ne.latitude, elev],
    [sw.longitude, ne.latitude, elev],
  ];
}

export interface TransformResult {
  segmentIndex: number;
  vertices: [number, number, number][];
}

export function transformSolarToModel(
  segments: RoofSegment[],
  buildingCenter: { latitude: number; longitude: number },
  modelScene: Object3D,
  rotationDeg: number,
): TransformResult[] {
  const bbox = new Box3().setFromObject(modelScene);
  const modelSize = new Vector3();
  bbox.getSize(modelSize);
  const modelCenter = new Vector3();
  bbox.getCenter(modelCenter);

  const mplng = metersPerDegLng(buildingCenter.latitude);

  const segPolys = segments.map((seg, i) => ({
    index: i,
    polygon: segmentToPolygon(seg),
  }));

  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const { polygon } of segPolys) {
    if (!polygon) continue;
    for (const [lng, lat] of polygon) {
      const e = (lng - buildingCenter.longitude) * mplng;
      const n = (lat - buildingCenter.latitude) * METERS_PER_DEG_LAT;
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
      if (n < minN) minN = n;
      if (n > maxN) maxN = n;
    }
  }

  if (!isFinite(minE)) return [];

  const realW = maxE - minE;
  const realD = maxN - minN;
  const realCE = (minE + maxE) / 2;
  const realCN = (minN + maxN) / 2;

  const sx = realW > 0.01 ? modelSize.x / realW : 1;
  const sz = realD > 0.01 ? modelSize.z / realD : 1;
  const scale = Math.min(sx, sz);

  const rot = rotationDeg * DEG_TO_RAD;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  const raycaster = new Raycaster();
  const down = new Vector3(0, -1, 0);

  const results: TransformResult[] = [];

  for (const { index, polygon } of segPolys) {
    if (!polygon) continue;

    const vertices: [number, number, number][] = polygon.map(([lng, lat]) => {
      const e = (lng - buildingCenter.longitude) * mplng - realCE;
      const n = (lat - buildingCenter.latitude) * METERS_PER_DEG_LAT - realCN;

      const se = e * scale;
      const sn = n * scale;

      const x = se * cosR - sn * sinR;
      const z = -(se * sinR + sn * cosR);

      raycaster.set(
        new Vector3(x + modelCenter.x, bbox.max.y + 5, z + modelCenter.z),
        down,
      );
      const hits = raycaster.intersectObject(modelScene, true);

      const y = hits.length > 0
        ? hits[0].point.y - modelCenter.y + 0.02
        : modelSize.y * 0.4;

      return [x, y, z] as [number, number, number];
    });

    results.push({ segmentIndex: index, vertices });
  }

  return results;
}
