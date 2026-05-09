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
import { useAutoSync } from "../hooks/useAutoSync";

type ViewMode = "satellite" | "topdown" | "3d";
type ToolId = "select" | "lasso" | "measure" | "split" | "note";
interface PanelPos { x: number; y: number; }
interface ToolDef { id: ToolId; label: string; icon: string; }



const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", icon: "◇" },
  { id: "lasso", label: "Lasso", icon: "○" },
  { id: "measure", label: "Measure", icon: "⌐" },
  { id: "split", label: "Split", icon: "⊘" },
  { id: "note", label: "Note", icon: "✎" },
];

const STORAGE_KEY = "estimator-panel-positions";

function loadPositions(): Record<string, PanelPos> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, PanelPos>;
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
  const mergedStyle: CSSProperties = {
    ...style,
    ...(pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {}),
  };
  return (
    <div
      className={`absolute backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.12)] ${className} ${editLayout ? "border-2 border-dashed border-blue cursor-move" : ""}`}
      style={mergedStyle}
      onMouseDown={editLayout ? (e) => onDragStart(id, e) : undefined}
    >
      {children}
    </div>
  );
}

export default function EstimatorPage() {
  const navigate = useNavigate();
  const {
    location, address, buildingInsights, selectedSegmentIndices, toggleSegmentIndex,
    selectAllSegments, clearSelectedSegments, estimateId, selectedMaterialId,
    setSelectedMaterialId, setSegmentPolygons,
  } = useEstimatorStore();
  const { isSyncing, lastSyncedAt, syncNow } = useAutoSync();
  const { data: materialsMap } = useMaterials();

  const handleNext = () => {
    syncNow();
    navigate("/pricing");
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

  const focusedSegment = focusedSegmentIndex != null ? segments[focusedSegmentIndex] ?? null : null;

  const panelDragRef = useRef<{ active: boolean; panelId: string; offsetX: number; offsetY: number }>({ active: false, panelId: "", offsetX: 0, offsetY: 0 });

  const handlePanelDragStart = useCallback((panelId: string, e: ReactMouseEvent) => {
    if (!editLayout) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    panelDragRef.current = { active: true, panelId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
  }, [editLayout]);

  useEffect(() => {
    if (!editLayout) return;
    const handleMove = (e: MouseEvent) => {
      if (!panelDragRef.current.active) return;
      const { panelId, offsetX, offsetY } = panelDragRef.current;
      setPanelPositions((prev) => {
        const next = { ...prev, [panelId]: { x: e.clientX - offsetX, y: e.clientY - offsetY } };
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

  return (
    <div className="fixed inset-0 font-sans text-ink overflow-hidden select-none" style={{ background: "linear-gradient(160deg, #1a2440 0%, #0e1830 100%)" }}>

      {/* Canvas — Google 3D Tiles (satellite), top-down blueprint, or 3D model */}
      <div className="absolute inset-0 z-0">
        {mode === "3d" ? (
          <ModelViewer address={address ?? ""} buildingInsights={buildingInsights} onClearSegments={clearSelectedSegments} />
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
          <Scene location={location} buildingInsights={buildingInsights} selectedIndices={selectedSegmentIndices} onToggleSegment={toggleSegmentIndex} onClearSegments={clearSelectedSegments} onCreditsUpdate={setCredits} />
        )}
      </div>

      {/* Top nav */}
      <GlassNav wrapperClassName="absolute top-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-48px)]" minWidth={1240}>
        <div className="flex items-center gap-4 shrink-0">
          <BrandMark size={30} />
          <div className="flex flex-col gap-px px-1">
            <span className="text-[13px] font-semibold text-white tracking-tight">Roof Estimate</span>
            <span className="text-[9.5px] font-mono text-white/45 tracking-wider">{estimateId ? `${estimateId.slice(0, 8).toUpperCase()} · Draft` : "Draft"}</span>
          </div>
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
        </div>

        <NavDivider />
        <StepCrumbs current={2} />

        <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />
        <div className="flex items-center gap-3 shrink-0">
          <NavIconButton icon="save" tooltip="Save" onClick={syncNow} />
          <NavIconButton icon="cancel" tooltip="Cancel" variant="danger" onClick={() => navigate("/estimates")} />
          <NavIconButton icon="arrow_forward" tooltip="Next" variant="primary" onClick={handleNext} disabled={selectedSegmentIndices.length === 0 || !selectedMaterialId} />
        </div>
      </GlassNav>

      {/* Spec card */}
      <GlassPanel id="spec" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-5" style={{ top: 90, left: 20, width: 320, zIndex: 30 }}>
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
                {focusedSegment ? `SEGMENT ${focusedSegmentIndex! + 1}` : selectedSegments.length > 0 ? `${selectedSegments.length} SEGMENT${selectedSegments.length > 1 ? "S" : ""} SELECTED` : "NO SEGMENT SELECTED"}
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

            {/* Estimate */}
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
              const totalEstimate = selectedArea * selectedMaterial.pricePerSf;
              const avgPitch = selectedSegments.filter((s) => s.pitch_degrees != null).reduce((sum, s, _, arr) => sum + s.pitch_degrees! / arr.length, 0);
              return (
                <>
                  <div className="w-full h-px bg-hair my-3" />
                  <span className="text-[11px] font-mono font-bold text-ink/70 tracking-wider uppercase mb-2 block">Estimate</span>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[12px] text-ink/60 font-mono font-semibold">Roof area</span>
                      <span className="text-[12px] font-mono font-bold text-ink">{Math.round(selectedArea).toLocaleString()} sf</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[12px] text-ink/60 font-mono font-semibold">Avg pitch</span>
                      <span className="text-[12px] font-mono font-bold text-ink">{avgPitch.toFixed(1)}°</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[12px] text-ink/60 font-mono font-semibold">Material</span>
                      <span className="text-[12px] font-mono font-bold text-ink">{selectedMaterial.name} · {selectedMaterial.sub}</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[12px] text-ink/60 font-mono font-semibold">Rate</span>
                      <span className="text-[12px] font-mono font-bold text-ink">{selectedMaterial.price}/sf</span>
                    </div>
                    <div className="w-full h-px bg-hair my-1" />
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
      </GlassPanel>

      {/* Faces panel (roof segments) */}
      <GlassPanel id="faces" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-4" style={{ top: 90, right: 20, width: 290, zIndex: 30 }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">SEGMENTS · {segments.length}</span>
          {segments.length > 0 && (
            <div className="flex gap-1">
              <button onClick={selectAllSegments}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border-none cursor-pointer bg-blue/10 text-blue hover:bg-blue/20 transition-colors">
                All
              </button>
              <button onClick={clearSelectedSegments}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border-none cursor-pointer bg-hair/60 text-muted hover:bg-hair transition-colors">
                None
              </button>
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
              return (
                <div key={i} onClick={() => setFocusedSegmentIndex(focusedSegmentIndex === i ? null : i)}
                  className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer transition-colors text-left font-sans ${isSel ? "bg-blue-100" : "bg-transparent hover:bg-hair/40"}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSegmentIndex(i); }}
                    className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 cursor-pointer bg-transparent p-0 ${isSel ? "border-blue bg-blue" : "border-hair"}`}>
                    {isSel && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <span className="flex-1 text-[12px] font-medium">
                    Segment {i + 1}<span className="text-[10px] text-muted ml-1.5">{seg.azimuth_degrees != null ? `${azimuthToCompass(seg.azimuth_degrees)}-facing` : ""}</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted">{Math.round(seg.area_sq_ft).toLocaleString()} sf</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No segments available.</p>
        )}
      </GlassPanel>

      {/* Material picker */}
      <GlassPanel id="materials" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-4" style={{ bottom: 100, right: 20, width: 290, zIndex: 30 }}>
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
      </GlassPanel>

      {/* Tool palette */}
      <div className="absolute z-40 flex items-center gap-1 py-2 px-3 bg-[#1a2440]/85 rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)]" style={{ bottom: 80, left: "50%", transform: "translateX(-50%)" }}>
        {TOOLS.map((tool) => (
          <button key={tool.id} onClick={() => setActiveTool(tool.id)} title={tool.label}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer transition-colors ${activeTool === tool.id ? "bg-white/20 text-white" : "bg-transparent text-white hover:bg-white/8"}`}>
            <span className="text-[16px] leading-none">{tool.icon}</span>
            <span className="text-[9px]">{tool.label}</span>
          </button>
        ))}
        <div className="w-px h-8 bg-white/12 mx-1" />
        <button title="Undo" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white hover:bg-white/8 transition-colors">
          <span className="text-[16px] leading-none">↩</span>
          <span className="text-[9px]">Undo</span>
        </button>
        <button onClick={() => clearSelectedSegments()} title="Deselect" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white hover:bg-white/8 transition-colors">
          <span className="text-[16px] leading-none">⟲</span>
          <span className="text-[9px]">Reset</span>
        </button>
        <div className="w-px h-8 bg-white/12 mx-1" />
        <button onClick={() => setEditLayout((v) => !v)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer transition-colors ${editLayout ? "bg-blue/30 text-blue-bright" : "bg-transparent text-white hover:bg-white/8"}`}>
          <span className="text-[16px] leading-none">⊞</span>
          <span className="text-[9px]">Layout</span>
        </button>
      </div>

      {/* Mode bar */}
      <div className="absolute z-40 flex items-center gap-1 p-1 bg-[#1a2440]/85 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.10)]" style={{ bottom: 24, left: "50%", transform: "translateX(-50%)" }}>
        {(["satellite", "topdown", "3d"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold font-mono border-none cursor-pointer transition-colors ${mode === m ? "bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.12)]" : "bg-transparent text-white hover:bg-white/10"}`}>
            {m === "topdown" ? "Top-down" : m === "3d" ? "3D Model" : "Satellite"}
          </button>
        ))}
      </div>

      <CrewChat />
    </div>
  );
}
