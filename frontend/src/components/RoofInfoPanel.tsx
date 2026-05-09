import type { BuildingInsightsResponse, RoofSegmentStat } from "../types/solar";

interface Props {
  segment: RoofSegmentStat | null;
  buildingInsights: BuildingInsightsResponse | null;
}

function azimuthToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

function m2ToFt2(m2: number): number {
  return m2 * 10.7639;
}

export default function RoofInfoPanel({ segment, buildingInsights }: Props) {
  if (!buildingInsights) {
    return (
      <div className="p-5 text-gray-500 text-sm">
        Submit an address to see building data.
      </div>
    );
  }

  const sp = buildingInsights.solarPotential;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Building Overview
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat
            label="Roof Area"
            value={`${sp.wholeRoofStats.areaMeters2.toFixed(0)} m²`}
          />
          <Stat
            label="Max Panels"
            value={sp.maxArrayPanelsCount.toString()}
          />
          <Stat
            label="Peak Sun"
            value={`${sp.maxSunshineHoursPerYear.toFixed(0)} hrs/yr`}
          />
          <Stat
            label="Segments"
            value={sp.roofSegmentStats.length.toString()}
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
              value={`${segment.pitchDegrees.toFixed(1)}°`}
            />
            <Stat
              label="Azimuth"
              value={`${segment.azimuthDegrees.toFixed(0)}° ${azimuthToCompass(segment.azimuthDegrees)}`}
            />
            <Stat
              label="Area"
              value={`${segment.stats.areaMeters2.toFixed(0)} m² / ${m2ToFt2(segment.stats.areaMeters2).toFixed(0)} ft²`}
            />
            <Stat
              label="Annual Sun"
              value={`${(segment.stats.sunshineQuantiles[5] ?? 0).toFixed(0)} hrs`}
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
