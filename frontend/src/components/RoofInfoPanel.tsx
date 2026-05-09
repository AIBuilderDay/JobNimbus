import type { BuildingInsightsResponse, RoofSegment } from "../types/solar";

interface Props {
  segment: RoofSegment | null;
  buildingInsights: BuildingInsightsResponse | null;
}

function azimuthToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

export default function RoofInfoPanel({ segment, buildingInsights }: Props) {
  if (!buildingInsights) {
    return (
      <div className="p-5 text-gray-500 text-sm">
        Submit an address to see building data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Building Overview
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat
            label="Roof Area"
            value={`${Math.round(buildingInsights.total_roof_area_sq_ft).toLocaleString()} sf`}
          />
          <Stat
            label="Segments"
            value={buildingInsights.segments.length.toString()}
          />
          <Stat
            label="Imagery"
            value={buildingInsights.imagery_quality ?? "—"}
          />
          <Stat
            label="Ground Area"
            value={`${Math.round(buildingInsights.segments.reduce((s, seg) => s + seg.ground_area_sq_ft, 0)).toLocaleString()} sf`}
          />
        </div>
      </div>

      {segment ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Selected Segment
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat
              label="Pitch"
              value={segment.pitch_degrees != null ? `${segment.pitch_degrees.toFixed(1)}°` : "—"}
            />
            <Stat
              label="Azimuth"
              value={segment.azimuth_degrees != null ? `${segment.azimuth_degrees.toFixed(0)}° ${azimuthToCompass(segment.azimuth_degrees)}` : "—"}
            />
            <Stat
              label="Area"
              value={`${Math.round(segment.area_sq_ft).toLocaleString()} sf`}
            />
            <Stat
              label="Height"
              value={segment.plane_height_meters != null ? `${(segment.plane_height_meters * 3.28084).toFixed(1)} ft` : "—"}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Click a roof segment on the 3D view for details.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-100 rounded p-3">
      <div className="text-gray-900 text-sm font-semibold">{label}</div>
      <div className="text-gray-800 text-base font-bold">{value}</div>
    </div>
  );
}
