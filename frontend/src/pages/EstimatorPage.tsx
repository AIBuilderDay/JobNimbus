import { useState, useCallback, useRef, useEffect, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import Scene from "../components/Scene";
import ModelViewer from "../components/ModelViewer";
import BrandMark from "../components/ui/BrandMark";
import CrewChat from "../components/CrewChat";
import { useEstimatorStore } from "../store/estimatorStore";
import { pollModelStatus, getModelUrl } from "../api/model3d";
import { toast } from "sonner";
import type { RoofSegment } from "../types/solar";
import { fetchAerialVideo } from "../api/estimates";
import RoofBlueprint, { type BlueprintSegment } from "../components/RoofBlueprint";

type ViewMode = "perspective" | "satellite" | "topdown";
type ToolId = "select" | "lasso" | "measure" | "split" | "note";
type MaterialTab = "shingle" | "metal" | "membrane";

interface MaterialCard { id: string; name: string; sub: string; price: string; swatch: string; }
interface PanelPos { x: number; y: number; }
interface Step { n: number; label: string; status: "done" | "current" | "todo"; path: string; }
interface ToolDef { id: ToolId; label: string; icon: string; }

const STEPS: Step[] = [
  { n: 1, label: "Address", status: "done", path: "/address" },
  { n: 2, label: "Materials", status: "current", path: "/estimator" },
  { n: 3, label: "Proposal", status: "todo", path: "/proposal" },
  { n: 4, label: "Finalize", status: "todo", path: "/finalization" },
];

const MATERIALS: Record<MaterialTab, MaterialCard[]> = {
  shingle: [
    { id: "arch-charcoal", name: "Architectural", sub: "Charcoal", price: "$1.85", swatch: "#3a3a3a" },
    { id: "arch-weathered", name: "Architectural", sub: "Weathered Wood", price: "$1.85", swatch: "#7a6b5a" },
    { id: "arch-onyx", name: "Architectural", sub: "Onyx Black", price: "$1.85", swatch: "#1a1a1a" },
    { id: "arch-pewter", name: "Architectural", sub: "Pewter Gray", price: "$1.85", swatch: "#8a8a8a" },
    { id: "des-barkwood", name: "Designer", sub: "Barkwood", price: "$2.40", swatch: "#5e4a38" },
    { id: "des-slate", name: "Designer", sub: "Slate", price: "$2.40", swatch: "#5a6570" },
  ],
  metal: [
    { id: "st-galv", name: "Standing Seam", sub: "Galvalume", price: "$4.50", swatch: "#b0b5b8" },
    { id: "st-charcoal", name: "Standing Seam", sub: "Charcoal", price: "$4.75", swatch: "#3a3f42" },
    { id: "st-forest", name: "Standing Seam", sub: "Forest Green", price: "$4.75", swatch: "#2d5a3d" },
    { id: "st-barn", name: "Standing Seam", sub: "Barn Red", price: "$4.75", swatch: "#7a2e2e" },
  ],
  membrane: [
    { id: "tpo-white", name: "TPO 60mil", sub: "White", price: "$3.20", swatch: "#f0f0f0" },
    { id: "tpo-tan", name: "TPO 60mil", sub: "Tan", price: "$3.20", swatch: "#c8b898" },
    { id: "epdm-black", name: "EPDM", sub: "Black", price: "$2.90", swatch: "#222222" },
    { id: "pvc-white", name: "PVC 50mil", sub: "White", price: "$3.50", swatch: "#e8e8e8" },
  ],
};

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
    location, address, satelliteImageUrl, buildingInsights, selectedSegmentIndex, setSelectedSegmentIndex,
    estimateId, modelStatus, modelUrl, modelError,
    setModelStatus, setModelUrl, setModelError,
  } = useEstimatorStore();

  const segments = buildingInsights?.segments ?? [];
  const selectedSegment: RoofSegment | null = selectedSegmentIndex >= 0 ? segments[selectedSegmentIndex] ?? null : null;

  const [mode, setMode] = useState<ViewMode>("satellite");
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [materialTab, setMaterialTab] = useState<MaterialTab>("shingle");
  const [editLayout, setEditLayout] = useState(false);
  const [panelPositions, setPanelPositions] = useState<Record<string, PanelPos>>(loadPositions);
  const [, setCredits] = useState("");

  /* -- Aerial View state -- */
  const [aerialState, setAerialState] = useState<
    "idle" | "loading" | "active" | "processing" | "error"
  >("idle");
  const [aerialVideoUrl, setAerialVideoUrl] = useState<string | null>(null);
  const [showAerialModal, setShowAerialModal] = useState(false);

  const handleAerialClick = useCallback(async () => {
    if (!address) return;

    if (aerialVideoUrl) {
      setShowAerialModal(true);
      return;
    }

    setAerialState("loading");
    try {
      const result = await fetchAerialVideo(address);
      const url =
        result.uris?.MP4_HIGH?.landscapeUri
        ?? result.uris?.MP4_MEDIUM?.landscapeUri
        ?? result.uris?.MP4_LOW?.landscapeUri;
      if (result.state === "ACTIVE" && url) {
        setAerialVideoUrl(url);
        setAerialState("active");
        setShowAerialModal(true);
      } else if (result.state === "PROCESSING") {
        setAerialState("processing");
      } else {
        setAerialState("error");
      }
    } catch (e) {
      console.error("Aerial fetch failed:", e);
      setAerialState("error");
    }
  }, [address, aerialVideoUrl]);

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

  const handleSelectSegment = useCallback((_segment: RoofSegment | null, index: number) => {
    setSelectedSegmentIndex(index);
  }, [setSelectedSegmentIndex]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!estimateId || modelStatus === "completed" || modelStatus === "failed" || modelStatus === "idle") return;

    pollRef.current = setInterval(async () => {
      try {
        const status = await pollModelStatus(estimateId);
        setModelStatus(status.status);
        if (status.status === "completed") {
          setModelUrl(getModelUrl(estimateId));
          toast.success("3D model ready", { description: "Switch to 3D view to see your roof model." });
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (status.status === "failed") {
          setModelError(status.error ?? "Generation failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        setModelError("Failed to check status");
        setModelStatus("failed");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [estimateId, modelStatus, setModelStatus, setModelUrl, setModelError]);

  const bi = buildingInsights;
  const totalAreaFt2 = bi?.total_roof_area_sq_ft ?? 0;

  return (
    <div className="fixed inset-0 font-sans text-ink overflow-hidden select-none" style={{ background: "linear-gradient(160deg, #1a2440 0%, #0e1830 100%)" }}>

      {/* Canvas — 3D model (perspective) or Google 3D Tiles (satellite/topdown) */}
      <div className="absolute inset-0 z-0">
        {mode === "perspective" ? (
          modelStatus === "completed" && modelUrl ? (
            <ModelViewer modelUrl={modelUrl} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              {(modelStatus === "pending" || modelStatus === "capturing" || modelStatus === "generating") && (
                <>
                  <div className="w-8 h-8 border-2 border-blue border-t-transparent rounded-full animate-spin" />
                  <span className="text-[13px] font-mono text-white/60">
                    {modelStatus === "pending" && "Starting 3D model..."}
                    {modelStatus === "capturing" && "Capturing building images..."}
                    {modelStatus === "generating" && "Generating 3D model..."}
                  </span>
                </>
              )}
              {modelStatus === "failed" && (
                <span className="text-[13px] font-mono text-red-400">
                  {modelError ?? "3D model generation failed"}
                </span>
              )}
              {modelStatus === "idle" && (
                <span className="text-[13px] font-mono text-white/40">
                  No 3D model available
                </span>
              )}
            </div>
          )
        ) : mode === "topdown" ? (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0e1830" }}>
            {segments.length > 0 ? (
              <RoofBlueprint
                segments={segments
                  .filter((seg) => seg.bounding_box != null)
                  .map((seg): BlueprintSegment => ({
                    id: seg.id,
                    pitch_degrees: seg.pitch_degrees,
                    azimuth_degrees: seg.azimuth_degrees,
                    area_sq_ft: seg.area_sq_ft,
                    bounding_box: seg.bounding_box!,
                    center: seg.center ?? undefined,
                  }))}
                width={820}
                height={600}
                dark
                selectedSegmentIds={selectedSegmentIndex >= 0 ? [selectedSegmentIndex] : []}
                onSegmentClick={(seg) =>
                  setSelectedSegmentIndex(seg.id === selectedSegmentIndex ? -1 : seg.id)
                }
                style={{ display: "block", width: "min(680px, 70vw, 70vh * 1.367)" }}
              />
            ) : (
              <div className="text-white/55 text-[13px]">No roof segments to display</div>
            )}
          </div>
        ) : (
          <Scene location={location} buildingInsights={buildingInsights} selectedIndex={selectedSegmentIndex} onSelectSegment={handleSelectSegment} onCreditsUpdate={setCredits} />
        )}
      </div>

      {/* Top nav */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-48px)]">
        <nav className="flex flex-row items-center justify-between py-3 pl-5 pr-3.5 bg-white/10 backdrop-blur-md rounded-[18px] shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)]" style={{ width: 1240 }}>
          <div className="flex items-center gap-4 shrink-0">
            <BrandMark size={30} />
            <div className="flex flex-col gap-px px-1">
              <span className="text-[13px] font-semibold text-white tracking-tight">Roof Estimate</span>
              <span className="text-[9.5px] font-mono text-white/45 tracking-wider">{estimateId ? `${estimateId.slice(0, 8).toUpperCase()} · Draft` : "Draft"}</span>
            </div>
            <div className="w-px h-6.5 bg-white/12" />
            {address ? (() => {
              const parsed = parseAddress(address);
              return (
                <div className="flex items-center gap-3 px-1">
                  <div className="flex flex-col gap-px">
                    <span className="text-[9.5px] font-mono text-white/45 tracking-wider uppercase">STREET</span>
                    <span className="text-xs font-semibold text-white font-mono">{parsed.street}</span>
                  </div>
                  {parsed.city && (
                    <div className="flex flex-col gap-px">
                      <span className="text-[9.5px] font-mono text-white/45 tracking-wider uppercase">CITY</span>
                      <span className="text-xs font-semibold text-white font-mono">{parsed.city}</span>
                    </div>
                  )}
                  {parsed.stateZip && (
                    <div className="flex flex-col gap-px">
                      <span className="text-[9.5px] font-mono text-white/45 tracking-wider uppercase">STATE / ZIP</span>
                      <span className="text-xs font-semibold text-white font-mono">{parsed.stateZip}</span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex flex-col gap-px px-1">
                <span className="text-[9.5px] font-mono text-white/45 tracking-wider uppercase">PROPERTY</span>
                <span className="text-xs font-semibold text-white font-mono">No address selected</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6.5 bg-white/12" />

          {/* Step crumbs */}
          <div className="flex items-center gap-1">
            {STEPS.map((step) => (
              <button key={step.n}
                onClick={() => step.status !== "todo" && step.path !== "/estimator" && navigate(step.path)}
                disabled={step.status === "todo"}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-mono font-semibold transition-colors border-none ${step.status === "todo" ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/10"} ${step.status === "current" ? "bg-blue/25 text-white" : "bg-transparent text-white"}`}>
                {step.status === "done" ? (
                  <span className="material-symbols-rounded text-[16px] text-green">check_circle</span>
                ) : (
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step.status === "current" ? "bg-blue text-white" : "bg-white/8 text-white/30"}`}>{step.n}</span>
                )}
                {step.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button className="group relative w-9 h-9 flex items-center justify-center bg-transparent text-white/85 border border-white/15 rounded-[10px] cursor-pointer hover:bg-white/8 transition-colors">
              <span className="material-symbols-rounded text-[20px]">save</span>
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-ink text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Save</span>
            </button>
            <button onClick={() => navigate("/estimates")} className="group relative w-9 h-9 flex items-center justify-center rounded-[10px] cursor-pointer border transition-colors" style={{ background: "rgba(220,60,60,0.15)", color: "#dc3c3c", borderColor: "rgba(220,60,60,0.3)" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,60,60,0.25)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(220,60,60,0.15)"; }}>
              <span className="material-symbols-rounded text-[20px]">cancel</span>
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-ink text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Cancel</span>
            </button>
            <button onClick={() => navigate("/pricing")} className="group relative w-9 h-9 flex items-center justify-center bg-white text-ink border-none rounded-[10px] cursor-pointer hover:bg-white/90 transition-colors">
              <span className="material-symbols-rounded text-[20px]">arrow_forward</span>
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-ink text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Next</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Spec card */}
      <GlassPanel id="spec" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-5" style={{ top: 90, left: 20, width: 320, zIndex: 30 }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">ROOF SPEC · LIVE</span>
        </div>
        <div className="text-[13px] font-semibold mb-2 break-words leading-tight">
          {address ?? "No address selected"}
        </div>
        {satelliteImageUrl && (
          <img
            src={satelliteImageUrl}
            alt="Satellite view of property"
            className="w-full rounded-lg border border-hair mb-3"
          />
        )}
        {address && (
          <button
            onClick={handleAerialClick}
            disabled={aerialState === "loading"}
            className="w-full mb-3 py-2 px-3 rounded-lg bg-blue text-white text-[11.5px] font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aerialState === "loading" && "Loading…"}
            {aerialState === "processing" && "Rendering — retry in a minute"}
            {aerialState === "error" && "Couldn't load — retry"}
            {(aerialState === "idle" || aerialState === "active") && "View 3D flyover →"}
          </button>
        )}
        <div className="text-[10.5px] font-mono text-muted mb-4">
          {bi
            ? `${Math.round(bi.total_roof_area_sq_ft).toLocaleString()} sq ft · ${bi.segments.length} faces`
            : "Loading building data..."}
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
                  <div className="text-[9px] font-mono text-muted-2 uppercase tracking-wider mb-0.5">{stat.label}</div>
                  <div className="text-[15px] font-semibold font-mono tracking-tight">{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="w-full h-px bg-hair mb-3" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">{selectedSegment ? "SELECTED SEGMENT" : "NO SEGMENT SELECTED"}</span>
              {selectedSegment && selectedSegment.azimuth_degrees != null && (
                <span className="text-[9.5px] font-mono bg-blue-soft text-blue px-2 py-0.5 rounded-full font-semibold">
                  {selectedSegment.azimuth_degrees.toFixed(0)}° {azimuthToCompass(selectedSegment.azimuth_degrees)}
                </span>
              )}
            </div>
            {selectedSegment ? (
              <div className="space-y-1.5">
                {[
                  { k: "Area", v: `${Math.round(selectedSegment.area_sq_ft).toLocaleString()} sf` },
                  { k: "Ground area", v: `${Math.round(selectedSegment.ground_area_sq_ft).toLocaleString()} sf` },
                  { k: "Pitch", v: selectedSegment.pitch_degrees != null ? `${selectedSegment.pitch_degrees.toFixed(1)}°` : "—" },
                  { k: "Azimuth", v: selectedSegment.azimuth_degrees != null ? `${selectedSegment.azimuth_degrees.toFixed(0)}° ${azimuthToCompass(selectedSegment.azimuth_degrees)}` : "—" },
                  { k: "Height at center", v: selectedSegment.plane_height_meters != null ? `${(selectedSegment.plane_height_meters * 3.28084).toFixed(1)} ft` : "—" },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between py-0.5">
                    <span className="text-[10.5px] text-muted font-mono">{row.k}</span>
                    <span className="text-[10.5px] font-mono font-semibold text-ink">{row.v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted">Click a roof segment on the 3D view for details.</p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-muted">No building data available. Solar API data will appear here when available.</p>
        )}
      </GlassPanel>

      {/* Faces panel (roof segments) */}
      <GlassPanel id="faces" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-4" style={{ top: 90, right: 20, width: 290, zIndex: 30 }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">SEGMENTS · {segments.length}</span>
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
              const isSel = i === selectedSegmentIndex;
              return (
                <button key={i} onClick={() => setSelectedSegmentIndex(isSel ? -1 : i)}
                  className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer transition-colors border-none text-left font-sans ${isSel ? "bg-blue-soft" : "bg-transparent hover:bg-hair/40"}`}>
                  <div className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center ${isSel ? "border-blue bg-blue" : "border-hair"}`}>
                    {isSel && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="flex-1 text-[12px] font-medium">
                    Segment {i + 1}<span className="text-[10px] text-muted ml-1.5">{seg.azimuth_degrees != null ? `${azimuthToCompass(seg.azimuth_degrees)}-facing` : ""}</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted">{Math.round(seg.area_sq_ft).toLocaleString()} sf</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No segments available.</p>
        )}
      </GlassPanel>

      {/* Material picker */}
      <GlassPanel id="materials" editLayout={editLayout} positions={panelPositions} onDragStart={handlePanelDragStart} className="bg-white/88 text-ink p-4" style={{ top: 90, right: 320, width: 290, zIndex: 30 }}>
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
          {MATERIALS[materialTab].map((mat) => (
            <button key={mat.id} className="flex flex-col items-start gap-1.5 p-2.5 bg-paper-2 border border-hair rounded-lg cursor-pointer hover:border-blue/40 transition-colors text-left">
              <div className="w-full h-6 rounded" style={{ backgroundColor: mat.swatch }} />
              <div>
                <div className="text-[11px] font-semibold leading-tight">{mat.name}</div>
                <div className="text-[10px] text-muted leading-tight">{mat.sub}</div>
              </div>
              <div className="text-[10px] font-mono font-semibold text-blue">{mat.price}/sf</div>
            </button>
          ))}
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
        <button onClick={() => setSelectedSegmentIndex(-1)} title="Deselect" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white hover:bg-white/8 transition-colors">
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
        {(["perspective", "satellite", "topdown"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold font-mono border-none cursor-pointer transition-colors ${mode === m ? "bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.12)]" : "bg-transparent text-white hover:bg-white/10"}`}>
            {m === "topdown" ? "Top-down" : m === "perspective" ? "3D" : "Satellite"}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  7. Ask Crew FAB                                              */}
      {/* ============================================================ */}
      <CrewChat />

      {/* ============================================================ */}
      {/*  Aerial View modal                                            */}
      {/* ============================================================ */}
      {showAerialModal && aerialVideoUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-8"
          onClick={() => setShowAerialModal(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <video
              src={aerialVideoUrl}
              autoPlay
              loop
              controls
              className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setShowAerialModal(false)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-ink hover:bg-white/90 cursor-pointer border-none shadow-lg flex items-center justify-center text-[16px] font-semibold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
