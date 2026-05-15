import { useState, useCallback, useRef, useEffect, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import Scene from "../components/Scene";
import BrandMark from "../components/ui/BrandMark";
import GlassNav, { NavDivider, NavMeta, NavIconButton, SavedIndicator } from "../components/ui/GlassNav";
import StepCrumbs from "../components/ui/StepCrumbs";
import CrewChat from "../components/CrewChat";
import { useEstimatorStore } from "../store/estimatorStore";
import { fetchRoofPolygons } from "../api/roofPolygons";
import type { RoofSegment } from "../types/solar";
import RoofBlueprint, { type BlueprintSegment } from "../components/RoofBlueprint";
import ModelViewer from "../components/ModelViewer";
import { useMaterials } from "../hooks/useEstimates";
import type { MaterialTab, MaterialCard } from "../api/estimates";
import { deleteDraft } from "../api/estimates";
import { useAutoSync } from "../hooks/useAutoSync";
import CancelModal from "../components/ui/CancelModal";

type ViewMode = "satellite" | "topdown" | "3d";
type ToolId = "select" | "lasso" | "measure" | "split" | "note";
interface PanelPos { x: number; y: number; anchor?: "left" | "right"; }
interface ToolDef { id: ToolId; label: string; icon: string; }



function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", icon: "◇" },
  { id: "lasso", label: "Lasso", icon: "○" },
  { id: "measure", label: "Measure", icon: "⌐" },
  { id: "split", label: "Split", icon: "⊘" },
  { id: "note", label: "Note", icon: "✎" },
];

const STORAGE_KEY = "estimator-panel-positions";
const RIGHT_ANCHORED = new Set(["faces", "materials"]);

function loadPositions(): Record<string, PanelPos> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Record<string, PanelPos>;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const valid: Record<string, PanelPos> = {};
    for (const [key, pos] of Object.entries(saved)) {
      if (pos.x >= 0 && pos.x < vw && pos.y >= 0 && pos.y < vh) {
        valid[key] = pos;
      }
    }
    return valid;
  } catch { /* ignore */ }
  return {};
}

let saveTimer: ReturnType<typeof setTimeout>;
function savePositions(positions: Record<string, PanelPos>) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)), 200);
}

function azimuthToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function stripCounty(s: string): string {
  return s.replace(/\s*[·\-–]\s*\w+\s+County/i, "").trim();
}

function parseAddress(addr: string) {
  const cleaned = stripCounty(addr);
  const parts = cleaned.split(",").map((s) => s.trim());
  const noCounty = parts.filter((p) => !/\bcounty\b/i.test(p));
  const street = noCounty[0] ?? cleaned;
  const city = noCounty[1] ?? "";
  const stateZipRaw = noCounty.length >= 4 ? noCounty[3] : noCounty[2] ?? "";
  const stateZip = stateZipRaw.replace(/\s*USA$/i, "").trim();
  return { street, city, stateZip };
}

function GlassPanel({ id, children, className = "", style, editLayout, positions, onDragStart }: {
  id: string; children: ReactNode; className?: string; style?: CSSProperties;
  editLayout: boolean; positions: Record<string, PanelPos>;
  onDragStart: (panelId: string, e: ReactMouseEvent) => void;
}) {
  const pos = positions[id];
  const panelW = typeof style?.width === "number" ? style.width : 300;
  let posOverride: CSSProperties | undefined;
  if (pos) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (pos.anchor === "right") {
      const r = Math.max(0, Math.min(pos.x, vw - panelW - 8));
      const t = Math.max(0, Math.min(pos.y, vh - 200));
      posOverride = { right: r, top: t, left: "auto", bottom: "auto" };
    } else {
      const l = Math.max(0, Math.min(pos.x, vw - panelW - 8));
      const t = Math.max(0, Math.min(pos.y, vh - 200));
      posOverride = { left: l, top: t, right: "auto", bottom: "auto" };
    }
  }
  const mergedStyle: CSSProperties = {
    ...style,
    maxHeight: "calc(100vh - 160px)",
    ...posOverride,
  };
  return (
    <div
      className={`absolute backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.12)] ${className} ${editLayout ? "border-2 border-dashed border-blue cursor-move" : ""}`}
      style={mergedStyle}
      onMouseDown={editLayout ? (e) => onDragStart(id, e) : undefined}
    >
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Extracted panel content components                                  */
/* ------------------------------------------------------------------ */

function SpecContent({ bi, focusedSegment, focusedSegmentIndex, selectedSegments, selectedMaterialId, materialsMap }: {
  bi: ReturnType<typeof useEstimatorStore.getState>["buildingInsights"];
  focusedSegment: RoofSegment | null; focusedSegmentIndex: number | null;
  selectedSegments: RoofSegment[]; selectedMaterialId: string | null;
  materialsMap: Record<MaterialTab, MaterialCard[]> | undefined;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-bold text-ink/70 tracking-wider uppercase">ROOF SPEC</span>
      </div>
      {bi ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: "Roof area", value: `${Math.round(bi.total_roof_area_sq_ft).toLocaleString()} sf` },
              { label: "Segments", value: bi.segments.length.toString() },
              { label: "Imagery", value: bi.imagery_quality ?? "—" },
              { label: "Ground area", value: `${Math.round(bi.segments.reduce((s, seg) => s + seg.ground_area_sq_ft, 0)).toLocaleString()} sf` },
            ].map((stat) => (
              <div key={stat.label} className="bg-paper-2 border border-hair rounded-lg px-3 py-2.5">
                <div className="text-[10px] font-mono font-semibold text-ink/50 uppercase tracking-wider mb-0.5">{stat.label}</div>
                <div className="text-[17px] font-bold font-mono tracking-tight text-ink">{stat.value}</div>
              </div>
            ))}
          </div>
          <div className="w-full h-px bg-hair mb-3" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-ink/70 tracking-wider uppercase">
              {focusedSegment ? `SEGMENT ${focusedSegmentIndex}` : selectedSegments.length > 0 ? `${selectedSegments.length} SEGMENT${selectedSegments.length > 1 ? "S" : ""} SELECTED` : "NO SEGMENT SELECTED"}
            </span>
            {selectedSegments.length > 0 && (
              <span className="text-[10px] font-mono text-ink/50">{selectedSegments.length} selected</span>
            )}
          </div>
          {focusedSegment ? (
            <div className="space-y-1.5">
              {[
                { k: "Area", v: `${Math.round(focusedSegment.area_sq_ft).toLocaleString()} sf` },
                { k: "Ground area", v: `${Math.round(focusedSegment.ground_area_sq_ft).toLocaleString()} sf` },
                { k: "Pitch", v: focusedSegment.pitch_degrees != null ? `${focusedSegment.pitch_degrees.toFixed(1)}°` : "—" },
                { k: "Azimuth", v: focusedSegment.azimuth_degrees != null ? `${focusedSegment.azimuth_degrees.toFixed(0)}° ${azimuthToCompass(focusedSegment.azimuth_degrees)}` : "—" },
                { k: "Height at center", v: focusedSegment.plane_height_meters != null ? `${(focusedSegment.plane_height_meters * 3.28084).toFixed(1)} ft` : "—" },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between py-0.5">
                  <span className="text-[12px] text-ink/60 font-mono font-semibold">{row.k}</span>
                  <span className="text-[12px] font-mono font-bold text-ink">{row.v}</span>
                </div>
              ))}
            </div>
          ) : selectedSegments.length > 0 ? (
            <div className="space-y-1.5">
              {[
                { k: "Combined area", v: `${Math.round(selectedSegments.reduce((s, seg) => s + seg.area_sq_ft, 0)).toLocaleString()} sf` },
                { k: "Combined ground", v: `${Math.round(selectedSegments.reduce((s, seg) => s + seg.ground_area_sq_ft, 0)).toLocaleString()} sf` },
                ...(selectedSegments.length === 1 ? [
                  { k: "Pitch", v: selectedSegments[0].pitch_degrees != null ? `${selectedSegments[0].pitch_degrees.toFixed(1)}°` : "—" },
                  { k: "Azimuth", v: selectedSegments[0].azimuth_degrees != null ? `${selectedSegments[0].azimuth_degrees.toFixed(0)}° ${azimuthToCompass(selectedSegments[0].azimuth_degrees)}` : "—" },
                  { k: "Height at center", v: selectedSegments[0].plane_height_meters != null ? `${(selectedSegments[0].plane_height_meters * 3.28084).toFixed(1)} ft` : "—" },
                ] : (() => {
                  const pitches = selectedSegments.filter((s) => s.pitch_degrees != null).map((s) => s.pitch_degrees!);
                  const heights = selectedSegments.filter((s) => s.plane_height_meters != null).map((s) => s.plane_height_meters!);
                  const azimuths = selectedSegments.filter((s) => s.azimuth_degrees != null).map((s) => s.azimuth_degrees!);
                  const avgPitch = pitches.length > 0 ? pitches.reduce((a, b) => a + b, 0) / pitches.length : null;
                  const avgHeight = heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : null;
                  const compassDirs = azimuths.map(azimuthToCompass);
                  const uniqueDirs = [...new Set(compassDirs)];
                  const azimuthDisplay = azimuths.length === 0 ? "—" : uniqueDirs.length === 1 ? `${uniqueDirs[0]}` : uniqueDirs.join(", ");
                  return [
                    { k: "Avg pitch", v: avgPitch != null ? `${avgPitch.toFixed(1)}°` : "—" },
                    { k: "Facing", v: azimuthDisplay },
                    { k: "Avg height", v: avgHeight != null ? `${(avgHeight * 3.28084).toFixed(1)} ft` : "—" },
                  ];
                })()),
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between py-0.5">
                  <span className="text-[12px] text-ink/60 font-mono font-semibold">{row.k}</span>
                  <span className="text-[12px] font-mono font-bold text-ink">{row.v}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink/50 font-semibold">Click roof segments to select them.</p>
          )}

          {(() => {
            const selectedArea = selectedSegments.reduce((s, seg) => s + seg.area_sq_ft, 0);
            let selectedMaterial: MaterialCard | undefined;
            if (selectedMaterialId && materialsMap) {
              for (const cards of Object.values(materialsMap)) {
                const found = cards.find((c) => c.id === selectedMaterialId);
                if (found) { selectedMaterial = found; break; }
              }
            }
            if (selectedSegments.length === 0 || !selectedMaterial) return null;
            const materialTotal = selectedArea * selectedMaterial.pricePerSf;
            const avgPitch = selectedSegments.filter((s) => s.pitch_degrees != null).reduce((sum, s, _, arr) => sum + s.pitch_degrees! / arr.length, 0);
            const dripEdgeLf = Math.round(Math.sqrt(selectedArea) * 4.2);
            const dripEdgeCost = dripEdgeLf * 3.2;
            const totalEstimate = materialTotal + dripEdgeCost;
            return (
              <>
                <div className="w-full h-px bg-hair my-3" />
                <span className="text-[11px] font-mono font-bold text-ink/70 tracking-wider uppercase mb-2 block">Estimate</span>
                <div className="space-y-1.5">
                  {[
                    { k: "Roof area", v: `${Math.round(selectedArea).toLocaleString()} sf` },
                    { k: "Avg pitch", v: `${avgPitch.toFixed(1)}°` },
                    { k: "Material", v: `${selectedMaterial.name} · ${selectedMaterial.sub}` },
                    { k: "Rate", v: `${selectedMaterial.price}/sf` },
                    { k: "Drip edge", v: `${dripEdgeLf} lf · $3.20/lf` },
                  ].map((row) => (
                    <div key={row.k} className="flex items-center justify-between py-0.5">
                      <span className="text-[12px] text-ink/60 font-mono font-semibold">{row.k}</span>
                      <span className="text-[12px] font-mono font-bold text-ink">{row.v}</span>
                    </div>
                  ))}
                  <div className="w-full h-px bg-hair my-1" />
                  {[
                    { k: "Materials", v: `$${materialTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                    { k: "Drip edge", v: `$${dripEdgeCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  ].map((row) => (
                    <div key={row.k} className="flex items-center justify-between py-0.5">
                      <span className="text-[12px] text-ink/60 font-mono font-semibold">{row.k}</span>
                      <span className="text-[12px] font-mono font-bold text-ink">{row.v}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[13px] font-mono font-bold text-ink">Total</span>
                    <span className="text-[17px] font-mono font-bold text-blue">${totalEstimate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </>
      ) : (
        <p className="text-[12px] text-ink/50 font-semibold">No building data available.</p>
      )}
    </>
  );
}

function FacesContent({ segments, totalAreaFt2, bi, selectedSegmentIndices, focusedSegmentIndex, setFocusedSegmentIndex, toggleSegmentIndex, selectAllSegments, clearSelectedSegments }: {
  segments: RoofSegment[]; totalAreaFt2: number;
  bi: ReturnType<typeof useEstimatorStore.getState>["buildingInsights"];
  selectedSegmentIndices: number[]; focusedSegmentIndex: number | null;
  setFocusedSegmentIndex: (i: number | null) => void;
  toggleSegmentIndex: (i: number) => void;
  selectAllSegments: () => void; clearSelectedSegments: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">SEGMENTS · {segments.length}</span>
        {segments.length > 0 && (
          <div className="flex gap-1">
            <button onClick={selectAllSegments} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border-none cursor-pointer bg-blue/10 text-blue hover:bg-blue/20 transition-colors">All</button>
            <button onClick={clearSelectedSegments} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border-none cursor-pointer bg-hair/60 text-muted hover:bg-hair transition-colors">None</button>
          </div>
        )}
      </div>
      <div className="text-[11px] text-muted mb-1">Roof segments</div>
      {bi && (
        <div className="text-[13px] font-semibold font-mono mb-3">
          {Math.round(totalAreaFt2).toLocaleString()} sf
          <span className="text-muted-2 font-normal text-[11px] ml-1">total roof</span>
        </div>
      )}
      {segments.length > 0 ? (
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {segments.map((seg, i) => {
            const isSel = selectedSegmentIndices.includes(i);
            const isFocused = focusedSegmentIndex === i;
            return (
              <div key={i} onClick={() => setFocusedSegmentIndex(isFocused ? null : i)}
                className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer transition-colors text-left font-sans border-2 ${isSel ? "bg-blue-100 border-transparent" : isFocused ? "bg-transparent border-blue" : "bg-transparent border-transparent hover:bg-hair/40"}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSegmentIndex(i); }}
                  className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 cursor-pointer bg-transparent p-0 ${isSel ? "border-blue bg-white" : "border-hair"}`}>
                  {isSel && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#4C85E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <span className="flex-1 text-[12px] font-medium">
                  Segment {i}<span className="text-[10px] text-muted ml-1.5">{seg.azimuth_degrees != null ? `${azimuthToCompass(seg.azimuth_degrees)}-facing` : ""}</span>
                </span>
                <span className="text-[11px] font-mono text-muted">{Math.round(seg.area_sq_ft).toLocaleString()} sf</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted">No segments available.</p>
      )}
    </>
  );
}

function MaterialsContent({ materialTab, setMaterialTab, materialsMap, selectedMaterialId, setSelectedMaterialId }: {
  materialTab: MaterialTab; setMaterialTab: (t: MaterialTab) => void;
  materialsMap: Record<MaterialTab, MaterialCard[]> | undefined;
  selectedMaterialId: string | null; setSelectedMaterialId: (id: string | null) => void;
}) {
  return (
    <>
      <div className="text-[9.5px] font-mono text-muted tracking-wider uppercase mb-2.5">Quick materials</div>
      <div className="flex gap-1 mb-3">
        {(["shingle", "metal", "membrane"] as const).map((tab) => (
          <button key={tab} onClick={() => setMaterialTab(tab)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-mono border-none cursor-pointer transition-colors ${materialTab === tab ? "bg-ink text-white" : "bg-hair/60 text-muted hover:bg-hair"}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto">
        {(materialsMap?.[materialTab] ?? []).map((mat) => {
          const selected = selectedMaterialId === mat.id;
          return (
            <button key={mat.id} onClick={() => setSelectedMaterialId(selected ? null : mat.id)}
              className={`flex flex-col items-start gap-1.5 p-2.5 rounded-lg cursor-pointer transition-colors text-left ${selected ? "bg-blue-soft border-2 border-blue" : "bg-paper-2 border border-hair hover:border-blue/40"}`}>
              <div className="w-full h-6 rounded relative" style={{ backgroundColor: mat.swatch }}>
                {selected && <span className="material-symbols-rounded absolute -top-1.5 -right-1.5 text-[16px] text-blue bg-white rounded-full">check_circle</span>}
              </div>
              <div>
                <div className="text-[11px] font-semibold leading-tight">{mat.name}</div>
                <div className="text-[10px] text-muted leading-tight">{mat.sub}</div>
              </div>
              <div className="text-[10px] font-mono font-semibold text-blue">{mat.price}/sf</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function EstimatorPage() {
  const navigate = useNavigate();
  const {
    location, address, buildingInsights, satelliteImageUrl, selectedSegmentIndices,
    toggleSegmentIndex, selectAllSegments, clearSelectedSegments, estimateId,
    selectedMaterialId, setSelectedMaterialId, setSegmentPolygons,
  } = useEstimatorStore();
  const { isSyncing, lastSyncedAt, syncNow } = useAutoSync();
  const { data: materialsMap } = useMaterials();

  useEffect(() => {
    if (!location || !buildingInsights) {
      navigate("/address", { replace: true });
    }
  }, [location, buildingInsights, navigate]);

  const handleNext = () => {
    syncNow();
    navigate("/pricing");
  };

  const handleCancelSave = async () => {
    setCancelSaving(true);
    try {
      await syncNow();
      useEstimatorStore.getState().reset();
      navigate("/estimates");
    } finally {
      setCancelSaving(false);
    }
  };

  const handleCancelDelete = async () => {
    setCancelDeleting(true);
    try {
      const id = useEstimatorStore.getState().estimateId;
      if (id) await deleteDraft(id.slice(0, 8).toUpperCase());
      useEstimatorStore.getState().reset();
      navigate("/estimates");
    } catch (err) {
      console.error("Delete failed:", err);
      setCancelDeleting(false);
    }
  };

  useEffect(() => {
    if (!location || !buildingInsights) return;
    const hasPolygons = buildingInsights.segments.some((s) => s.polygon);
    if (hasPolygons) return;

    let cancelled = false;
    fetchRoofPolygons(location.lat, location.lng).then((res) => {
      if (cancelled || !res) return;
      setSegmentPolygons(res.polygons);
    });
    return () => { cancelled = true; };
  }, [location, buildingInsights, setSegmentPolygons]);

  const segments = buildingInsights?.segments ?? [];
  const selectedSegments: RoofSegment[] = selectedSegmentIndices
    .map((i) => segments[i])
    .filter((s): s is RoofSegment => s != null);

  const [mode, setMode] = useState<ViewMode>("satellite");
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [materialTab, setMaterialTab] = useState<MaterialTab>("shingle");
  const [editLayout, setEditLayout] = useState(false);
  const [panelPositions, setPanelPositions] = useState<Record<string, PanelPos>>(loadPositions);
  const [, setCredits] = useState("");
  const [focusedSegmentIndex, setFocusedSegmentIndex] = useState<number | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelDeleting, setCancelDeleting] = useState(false);

  const windowWidth = useWindowWidth();
  const isCompact = windowWidth < 1024;
  const isNarrow = windowWidth < 768;

  const [activeDrawerTab, setActiveDrawerTab] = useState<"spec" | "segments" | "materials">("spec");

  const focusedSegment = focusedSegmentIndex != null ? segments[focusedSegmentIndex] ?? null : null;

  const panelDragRef = useRef<{ active: boolean; panelId: string; offsetX: number; offsetY: number; panelWidth: number }>({ active: false, panelId: "", offsetX: 0, offsetY: 0, panelWidth: 0 });

  const handlePanelDragStart = useCallback((panelId: string, e: ReactMouseEvent) => {
    if (!editLayout) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    panelDragRef.current = { active: true, panelId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, panelWidth: rect.width };
  }, [editLayout]);

  useEffect(() => {
    if (!editLayout) return;
    const handleMove = (e: MouseEvent) => {
      if (!panelDragRef.current.active) return;
      const { panelId, offsetX, offsetY, panelWidth } = panelDragRef.current;
      setPanelPositions((prev) => {
        const leftEdge = e.clientX - offsetX;
        const pos: PanelPos = RIGHT_ANCHORED.has(panelId)
          ? { x: window.innerWidth - leftEdge - panelWidth, y: e.clientY - offsetY, anchor: "right" }
          : { x: leftEdge, y: e.clientY - offsetY, anchor: "left" };
        const next = { ...prev, [panelId]: pos };
        savePositions(next);
        return next;
      });
    };
    const handleUp = () => { panelDragRef.current.active = false; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [editLayout]);

  const bi = buildingInsights;
  const totalAreaFt2 = bi?.total_roof_area_sq_ft ?? 0;

  const specWidth = isCompact ? undefined : Math.min(320, Math.max(240, Math.round(windowWidth * 0.22)));
  const sideWidth = isCompact ? undefined : Math.min(290, Math.max(220, Math.round(windowWidth * 0.2)));
  const panelInset = isCompact ? 8 : Math.max(12, Math.min(20, Math.round((windowWidth - 1024) * 0.1 + 12)));

  return (
    <div className="fixed inset-0 font-sans text-ink overflow-hidden select-none" style={{ background: "linear-gradient(160deg, #1a2440 0%, #0e1830 100%)" }}>

      {/* Canvas — Google 3D Tiles (satellite), top-down blueprint, or 3D model */}
      <div className="absolute inset-0 z-0">
        {mode === "3d" ? (
          <ModelViewer address={address ?? ""} buildingInsights={buildingInsights} />
        ) : mode === "topdown" ? (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0e1830" }}>
            {segments.length > 0 ? (
              <RoofBlueprint
                segments={segments
                  .map((seg, i): BlueprintSegment | null => seg.bounding_box == null ? null : ({
                    id: seg.id,
                    index: i,
                    pitch_degrees: seg.pitch_degrees,
                    azimuth_degrees: seg.azimuth_degrees,
                    area_sq_ft: seg.area_sq_ft,
                    bounding_box: seg.bounding_box,
                    center: seg.center ?? undefined,
                  }))
                  .filter((s): s is BlueprintSegment => s !== null)}
                width={820}
                height={600}
                dark
                selectedSegmentIds={selectedSegmentIndices}
                onSegmentClick={(seg) => toggleSegmentIndex(seg.index)}
                style={{ display: "block", width: "min(680px, 70vw, 70vh * 1.367)" }}
              />
            ) : (
              <div className="text-white/55 text-[13px]">No roof segments to display</div>
            )}
          </div>
        ) : (
          <Scene location={location} buildingInsights={buildingInsights} selectedIndices={selectedSegmentIndices} onToggleSegment={toggleSegmentIndex} onClearSegments={clearSelectedSegments} onCreditsUpdate={setCredits} satelliteImageUrl={satelliteImageUrl} />
        )}
      </div>

      {/* Top nav */}
      <GlassNav wrapperClassName="absolute top-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-48px)]" minWidth={isCompact ? undefined : 1240}>
        <div className="flex items-center gap-4 shrink-0 min-w-0">
          <BrandMark size={30} />
          <div className="flex flex-col gap-px px-1 min-w-0">
            <span className="text-[13px] font-semibold text-white tracking-tight truncate">Roof Estimate</span>
            <span className="text-[9.5px] font-mono text-white/45 tracking-wider truncate">{estimateId ? `${estimateId.slice(0, 8).toUpperCase()} · Draft` : "Draft"}</span>
          </div>
          {!isCompact && (
            <>
              <NavDivider />
              {address ? (() => {
                const parsed = parseAddress(address);
                return (
                  <div className="flex items-center gap-3 px-1">
                    <NavMeta label="STREET" value={parsed.street} />
                    {parsed.city && <NavMeta label="CITY" value={parsed.city} />}
                    {parsed.stateZip && <NavMeta label="STATE / ZIP" value={parsed.stateZip} />}
                  </div>
                );
              })() : (
                <NavMeta label="PROPERTY" value="No address selected" />
              )}
            </>
          )}
        </div>

        {!isNarrow && (
          <>
            <NavDivider />
            <StepCrumbs current={2} />
          </>
        )}

        {!isCompact && <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />}
        <div className="flex items-center gap-2 shrink-0">
          {!isNarrow && <NavIconButton icon="save" tooltip="Save" onClick={syncNow} />}
          <NavIconButton icon="cancel" tooltip="Cancel" variant="danger" onClick={() => setCancelModalOpen(true)} />
          <NavIconButton icon="arrow_forward" tooltip="Next" variant="primary" onClick={handleNext} disabled={selectedSegmentIndices.length === 0 || !selectedMaterialId} />
        </div>
      </GlassNav>

      {/* ---------- PANELS: desktop = floating, compact = bottom drawer ---------- */}
      {!isCompact ? (
        <>
          {/* Spec card */}
          <GlassPanel id="spec" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-5" style={{ top: 90, left: panelInset, width: specWidth, zIndex: 30 }}>
            <SpecContent bi={bi} focusedSegment={focusedSegment} focusedSegmentIndex={focusedSegmentIndex} selectedSegments={selectedSegments} selectedMaterialId={selectedMaterialId} materialsMap={materialsMap} />
          </GlassPanel>

          {/* Faces panel */}
          <GlassPanel id="faces" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-4" style={{ top: 90, right: panelInset, width: sideWidth, zIndex: 30 }}>
            <FacesContent segments={segments} totalAreaFt2={totalAreaFt2} bi={bi} selectedSegmentIndices={selectedSegmentIndices} focusedSegmentIndex={focusedSegmentIndex} setFocusedSegmentIndex={setFocusedSegmentIndex} toggleSegmentIndex={toggleSegmentIndex} selectAllSegments={selectAllSegments} clearSelectedSegments={clearSelectedSegments} />
          </GlassPanel>

          {/* Material picker */}
          <GlassPanel id="materials" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-4" style={{ bottom: 100, right: panelInset, width: sideWidth, zIndex: 30 }}>
            <MaterialsContent materialTab={materialTab} setMaterialTab={setMaterialTab} materialsMap={materialsMap} selectedMaterialId={selectedMaterialId} setSelectedMaterialId={setSelectedMaterialId} />
          </GlassPanel>
        </>
      ) : (
        /* Compact: tabbed bottom drawer */
        <div className="absolute bottom-[120px] left-2 right-2 z-30 flex flex-col bg-white/92 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.22),0_0_0_1px_rgba(255,255,255,0.12)]" style={{ maxHeight: "45vh" }}>
          {/* Tab bar */}
          <div className="flex border-b border-hair shrink-0">
            {([
              { key: "spec" as const, label: "Spec", icon: "square_foot" },
              { key: "segments" as const, label: "Segments", icon: "grid_view" },
              { key: "materials" as const, label: "Materials", icon: "palette" },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveDrawerTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-mono font-semibold border-none cursor-pointer transition-colors ${
                  activeDrawerTab === t.key ? "text-blue bg-blue-soft/50" : "text-muted bg-transparent hover:bg-paper-2"
                }`}
              >
                <span className="material-symbols-rounded text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(45vh - 44px)" }}>
            {activeDrawerTab === "spec" && (
              <SpecContent bi={bi} focusedSegment={focusedSegment} focusedSegmentIndex={focusedSegmentIndex} selectedSegments={selectedSegments} selectedMaterialId={selectedMaterialId} materialsMap={materialsMap} />
            )}
            {activeDrawerTab === "segments" && (
              <FacesContent segments={segments} totalAreaFt2={totalAreaFt2} bi={bi} selectedSegmentIndices={selectedSegmentIndices} focusedSegmentIndex={focusedSegmentIndex} setFocusedSegmentIndex={setFocusedSegmentIndex} toggleSegmentIndex={toggleSegmentIndex} selectAllSegments={selectAllSegments} clearSelectedSegments={clearSelectedSegments} />
            )}
            {activeDrawerTab === "materials" && (
              <MaterialsContent materialTab={materialTab} setMaterialTab={setMaterialTab} materialsMap={materialsMap} selectedMaterialId={selectedMaterialId} setSelectedMaterialId={setSelectedMaterialId} />
            )}
          </div>
        </div>
      )}

      {/* Tool palette */}
      <div className="absolute z-40 flex items-center gap-1 py-2 px-3 bg-[#1a2440]/85 rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)] max-w-[calc(100vw-32px)] overflow-x-auto" style={{ bottom: 80, left: "50%", transform: "translateX(-50%)" }}>
        {TOOLS.map((tool) => (
          <button key={tool.id} onClick={() => setActiveTool(tool.id)} title={tool.label}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer transition-colors shrink-0 ${activeTool === tool.id ? "bg-white/20 text-white" : "bg-transparent text-white hover:bg-white/8"}`}>
            <span className="text-[16px] leading-none">{tool.icon}</span>
            {!isNarrow && <span className="text-[9px]">{tool.label}</span>}
          </button>
        ))}
        <div className="w-px h-8 bg-white/12 mx-1 shrink-0" />
        <button title="Undo" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white hover:bg-white/8 transition-colors shrink-0">
          <span className="text-[16px] leading-none">↩</span>
          {!isNarrow && <span className="text-[9px]">Undo</span>}
        </button>
        <button onClick={() => clearSelectedSegments()} title="Deselect" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white hover:bg-white/8 transition-colors shrink-0">
          <span className="text-[16px] leading-none">⟲</span>
          {!isNarrow && <span className="text-[9px]">Reset</span>}
        </button>
        {!isNarrow && (
          <>
            <div className="w-px h-8 bg-white/12 mx-1 shrink-0" />
            <button onClick={() => setEditLayout((v) => !v)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer transition-colors shrink-0 ${editLayout ? "bg-blue/30 text-blue-bright" : "bg-transparent text-white hover:bg-white/8"}`}>
              <span className="text-[16px] leading-none">⊞</span>
              <span className="text-[9px]">Layout</span>
            </button>
          </>
        )}
      </div>

      {/* Mode bar */}
      <div className="absolute z-40 left-0 right-0 flex justify-center pointer-events-none" style={{ bottom: 24 }}>
        <div className="flex items-center gap-1 p-1 bg-[#1a2440]/85 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.10)] pointer-events-auto">
        {(["satellite", "topdown", "3d"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold font-mono border-none cursor-pointer transition-colors whitespace-nowrap ${mode === m ? "bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.12)]" : "bg-transparent text-white hover:bg-white/10"}`}>
            {m === "topdown" ? "Top-down" : m === "3d" ? "3D" : "Satellite"}
          </button>
        ))}
        </div>
      </div>

      <CrewChat />

      <CancelModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onSaveDraft={handleCancelSave}
        onDeleteDraft={handleCancelDelete}
        saving={cancelSaving}
        deleting={cancelDeleting}
      />
    </div>
  );
}
