import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RoofBlueprint, { type BlueprintSegment } from "../components/RoofBlueprint";
import type { BackendEstimate } from "../api/estimates";

export default function BlueprintPage() {
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("latest-estimate");
    if (!stored) return;
    try {
      setEstimate(JSON.parse(stored));
    } catch {
      /* ignore malformed cache */
    }
  }, []);

  if (!estimate?.solar?.segments?.length) {
    return (
      <div className="min-h-screen bg-paper-2 flex items-center justify-center font-sans">
        <div className="text-center">
          <p className="text-muted mb-4 text-[14px]">No roof data available yet.</p>
          <Link to="/address" className="text-blue underline text-[13px]">
            Start a new estimate →
          </Link>
        </div>
      </div>
    );
  }

  const segments = estimate.solar.segments as unknown as BlueprintSegment[];

  return (
    <div className="min-h-screen bg-paper-2 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-[10.5px] font-mono text-muted uppercase tracking-[0.15em] mb-1">
              Roof takeoff drawing
            </div>
            <h1 className="text-3xl font-serif text-ink leading-tight">Blueprint</h1>
            <p className="text-[13px] text-muted mt-1">{estimate.address}</p>
          </div>
          <Link
            to="/estimator"
            className="text-[12px] font-semibold text-muted hover:text-ink no-underline"
          >
            ← Back to estimator
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] p-6">
          <RoofBlueprint segments={segments} width={900} height={560} style={{ width: "100%", height: "auto" }} />
        </div>

        <div className="mt-6 flex items-center justify-between text-[11px] font-mono text-muted">
          <span>Generated from Solar API roof segments</span>
          <span>{segments.length} face{segments.length === 1 ? "" : "s"} · approximate alignment</span>
        </div>
      </div>
    </div>
  );
}
