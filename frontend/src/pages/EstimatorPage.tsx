import { useState, useCallback, useRef, useEffect, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import HouseModel, { ROOF_FACES, ROOF_META } from "../models/HouseModel";
import BrandMark from "../components/ui/BrandMark";
import { fetchAerialVideo, type BackendEstimate } from "../api/estimates";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewMode = "abstract" | "satellite" | "topdown";
type ToolId = "select" | "lasso" | "measure" | "split" | "note";
type MaterialTab = "shingle" | "metal" | "membrane";

interface MaterialCard {
  id: string;
  name: string;
  sub: string;
  price: string;
  swatch: string;
}

interface PanelPos {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/*  Step crumbs data                                                   */
/* ------------------------------------------------------------------ */

interface Step {
  n: number;
  label: string;
  status: "done" | "current" | "todo";
}

const STEPS: Step[] = [
  { n: 1, label: "Capture", status: "done" },
  { n: 2, label: "Faces", status: "done" },
  { n: 3, label: "Materials", status: "current" },
  { n: 4, label: "Pricing", status: "todo" },
  { n: 5, label: "Proposal", status: "todo" },
];

/* ------------------------------------------------------------------ */
/*  Material data                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Tool definitions                                                   */
/* ------------------------------------------------------------------ */

interface ToolDef {
  id: ToolId;
  label: string;
  icon: string;
}

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", icon: "◇" },
  { id: "lasso", label: "Lasso", icon: "○" },
  { id: "measure", label: "Measure", icon: "⌐" },
  { id: "split", label: "Split", icon: "⊘" },
  { id: "note", label: "Note", icon: "✎" },
];

/* ------------------------------------------------------------------ */
/*  Saved positions helper                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "estimator-panel-positions";

function loadPositions(): Record<string, PanelPos> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, PanelPos>;
  } catch { /* ignore */ }
  return {};
}

function savePositions(positions: Record<string, PanelPos>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

/* ------------------------------------------------------------------ */
/*  Glassmorphic panel wrapper                                         */
/* ------------------------------------------------------------------ */

function GlassPanel({
  id,
  children,
  className = "",
  style,
  editLayout,
  positions,
  onDragStart,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  editLayout: boolean;
  positions: Record<string, PanelPos>;
  onDragStart: (panelId: string, e: ReactMouseEvent) => void;
}) {
  const pos = positions[id];
  const mergedStyle: CSSProperties = {
    ...style,
    ...(pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {}),
  };

  return (
    <div
      className={`absolute backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.12)] ${className} ${
        editLayout
          ? "border-2 border-dashed border-blue cursor-move"
          : ""
      }`}
      style={mergedStyle}
      onMouseDown={editLayout ? (e) => onDragStart(id, e) : undefined}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function EstimatorPage() {
  const navigate = useNavigate();

  /* -- State -- */
  const [mode, setMode] = useState<ViewMode>("abstract");
  const [selected, setSelected] = useState<string[]>(["rE", "rW"]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0.45);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [materialTab, setMaterialTab] = useState<MaterialTab>("shingle");
  const [editLayout, setEditLayout] = useState(false);
  const [panelPositions, setPanelPositions] = useState<Record<string, PanelPos>>(loadPositions);
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

  /* -- Aerial View state -- */
  const [aerialState, setAerialState] = useState<
    "idle" | "loading" | "active" | "processing" | "error"
  >("idle");
  const [aerialVideoUrl, setAerialVideoUrl] = useState<string | null>(null);
  const [showAerialModal, setShowAerialModal] = useState(false);

  const handleAerialClick = useCallback(async () => {
    if (!estimate?.address) return;

    if (aerialVideoUrl) {
      setShowAerialModal(true);
      return;
    }

    setAerialState("loading");
    try {
      const result = await fetchAerialVideo(estimate.address);
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
  }, [estimate?.address, aerialVideoUrl]);

  /* -- Drag rotation state -- */
  const dragRef = useRef<{ dragging: boolean; startX: number; startRot: number }>({
    dragging: false,
    startX: 0,
    startRot: 0,
  });

  const handleCanvasMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (mode !== "abstract") return;
      // Only start drag on the canvas background
      const target = e.target as HTMLElement;
      if (target.tagName === "polygon") return;
      dragRef.current = { dragging: true, startX: e.clientX, startRot: rotation };
    },
    [mode, rotation],
  );

  const handleCanvasMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      setRotation(dragRef.current.startRot + dx * 0.008);
    },
    [],
  );

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  /* -- Panel drag (edit layout mode) -- */
  const panelDragRef = useRef<{
    active: boolean;
    panelId: string;
    offsetX: number;
    offsetY: number;
  }>({ active: false, panelId: "", offsetX: 0, offsetY: 0 });

  const handlePanelDragStart = useCallback(
    (panelId: string, e: ReactMouseEvent) => {
      if (!editLayout) return;
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      panelDragRef.current = {
        active: true,
        panelId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
    },
    [editLayout],
  );

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

    const handleUp = () => {
      panelDragRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [editLayout]);

  /* -- Derived -- */
  const selectedArea = selected.reduce((sum, id) => {
    const meta = ROOF_META[id];
    return meta ? sum + meta.area : sum;
  }, 0);

  const totalArea = ROOF_FACES.reduce((sum, f) => sum + f.area, 0);

  /* -- Rotation controls -- */
  const rotateLeft = () => setRotation((r) => r - 0.3);
  const rotateRight = () => setRotation((r) => r + 0.3);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div
      className="fixed inset-0 font-sans text-ink overflow-hidden select-none"
      style={{ background: "linear-gradient(160deg, #1a2440 0%, #0e1830 100%)" }}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
    >
      {/* Grid pattern */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_95%)]" />

      {/* Radial glows */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(76,133,229,0.12),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(56,104,198,0.10),transparent_55%)]" />

      {/* ============================================================ */}
      {/*  3D Canvas                                                    */}
      {/* ============================================================ */}
      <div
        className="absolute inset-0 flex items-center justify-center z-0"
        style={{ cursor: mode === "abstract" ? "grab" : "default" }}
        onMouseDown={handleCanvasMouseDown}
      >
        <div style={{ width: 600, height: 480 }}>
          <HouseModel
            mode={mode}
            selected={selected}
            setSelected={setSelected}
            hovered={hovered}
            setHovered={setHovered}
            rotation={rotation}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Hover callout                                                */}
      {/* ============================================================ */}
      {hovered && ROOF_META[hovered] && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ top: 60, left: "50%", transform: "translateX(-50%)" }}
        >
          <div className="bg-white/90 backdrop-blur-xl rounded-lg px-3.5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center gap-2.5">
            <span className="text-[12px] font-semibold text-ink font-mono">
              {ROOF_META[hovered].label}
            </span>
            <span className="w-px h-3.5 bg-hair-2" />
            <span className="text-[11px] text-muted font-mono">
              {ROOF_META[hovered].area} sf
            </span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  1. Top nav                                                   */}
      {/* ============================================================ */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40">
        <nav className="flex items-center gap-4 py-3 pl-5 pr-3.5 bg-white/10 backdrop-blur-2xl rounded-[18px] shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)]">
          {/* Brand */}
          <BrandMark size={30} />
          <div className="flex flex-col gap-px px-1">
            <span className="text-[13px] font-semibold text-white tracking-tight">
              Re-roof estimate
            </span>
            <span className="text-[9.5px] font-mono text-white/45 tracking-wider">
              {estimate?.estimate_id
                ? `EST-${estimate.estimate_id.slice(0, 8).toUpperCase()} · Draft`
                : "EST-2418 · Draft"}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-6.5 bg-white/12" />

          {/* Property meta */}
          <div className="flex flex-col gap-px px-1">
            <span className="text-[9.5px] font-mono text-white/45 tracking-wider uppercase">
              PROPERTY
            </span>
            <span className="text-xs font-semibold text-white font-mono truncate max-w-[280px]">
              {estimate?.address ?? "412 W Holloway Ave · Tampa, FL"}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-6.5 bg-white/12" />

          {/* Step crumbs */}
          <div className="flex items-center gap-1">
            {STEPS.map((step) => (
              <button
                key={step.n}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors cursor-default border-none ${
                  step.status === "current"
                    ? "bg-blue/25 text-blue-bright"
                    : step.status === "done"
                      ? "bg-transparent text-white/55"
                      : "bg-transparent text-white/30"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    step.status === "done"
                      ? "bg-green/30 text-green"
                      : step.status === "current"
                        ? "bg-blue text-white"
                        : "bg-white/8 text-white/30"
                  }`}
                >
                  {step.status === "done" ? "✓" : step.n}
                </span>
                {step.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-6.5 bg-white/12" />

          {/* Saved indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/70 font-mono px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5fd39a] shadow-[0_0_0_3px_rgba(95,211,154,0.2)]" />
            Synced
          </div>

          {/* Divider */}
          <div className="w-px h-6.5 bg-white/12" />

          {/* Actions */}
          <button className="py-2.5 px-3 bg-transparent text-white/85 border border-white/15 rounded-[10px] text-[12.5px] font-semibold cursor-pointer font-sans">
            Save copy
          </button>
          <button
            onClick={() => navigate("/pricing")}
            className="py-2.5 px-3.5 bg-white text-ink border-none rounded-[10px] text-[12.5px] font-semibold cursor-pointer font-sans tracking-tight"
          >
            Next · Pricing
          </button>
        </nav>
      </div>

      {/* ============================================================ */}
      {/*  2. Spec card                                                 */}
      {/* ============================================================ */}
      <GlassPanel
        id="spec"
        editLayout={editLayout}
        positions={panelPositions}
        onDragStart={handlePanelDragStart}
        className="bg-white/88 text-ink p-5"
        style={{ top: 90, left: 20, width: 320, zIndex: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">
            ROOF SPEC · LIVE
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_0_3px_rgba(58,166,118,0.2)]" />
        </div>
        <div className="text-[13px] font-semibold mb-2 break-words leading-tight">
          {estimate?.address ?? "412 W Holloway Ave"}
        </div>
        {estimate?.satellite_image_url && (
          <img
            src={estimate.satellite_image_url}
            alt="Satellite view of property"
            className="w-full rounded-lg border border-hair mb-3"
          />
        )}
        {estimate?.address && (
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
          {estimate?.solar?.total_roof_area_sq_ft != null
            ? `${Math.round(estimate.solar.total_roof_area_sq_ft).toLocaleString()} sq ft · ${estimate.solar.segments?.length ?? 0} faces`
            : "Parcel 191724-A · Hillsborough County"}
        </div>

        {/* Rotation controls */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            onClick={rotateLeft}
            className="w-7 h-7 rounded-md bg-hair/60 border border-hair-2 text-muted text-[14px] flex items-center justify-center cursor-pointer hover:bg-hair"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-2 uppercase tracking-wider">
              Rotation
            </span>
            <span className="text-[12px] font-mono font-semibold text-ink">
              {(((rotation * 180) / Math.PI) % 360).toFixed(0)}°
            </span>
          </div>
          <button
            onClick={rotateRight}
            className="w-7 h-7 rounded-md bg-hair/60 border border-hair-2 text-muted text-[14px] flex items-center justify-center cursor-pointer hover:bg-hair"
          >
            →
          </button>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Slant area", value: "22.4 sq" },
            { label: "Footprint", value: "1,860 sf" },
            { label: "Pitch", value: "6/12" },
            { label: "Height", value: "24'8\"" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-paper-2 border border-hair rounded-lg px-3 py-2.5"
            >
              <div className="text-[9px] font-mono text-muted-2 uppercase tracking-wider mb-0.5">
                {stat.label}
              </div>
              <div className="text-[15px] font-semibold font-mono tracking-tight">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-hair mb-3" />

        {/* Selected section */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">
            SELECTED · {selected.length}
          </span>
          {selected.length > 0 && (
            <span className="text-[9.5px] font-mono bg-blue-soft text-blue px-2 py-0.5 rounded-full font-semibold">
              {ROOF_META[selected[0]]?.azimuth ?? "—"}° azimuth
            </span>
          )}
        </div>

        {/* Key-value pairs */}
        <div className="space-y-1.5">
          {[
            { k: "Per-facet area", v: selected.length > 0 ? `${selectedArea / selected.length} sf` : "—" },
            { k: "Pitch", v: selected.length > 0 ? ROOF_META[selected[0]]?.pitch ?? "—" : "—" },
            { k: "Azimuth", v: selected.length > 0 ? `${ROOF_META[selected[0]]?.azimuth ?? "—"}°` : "—" },
            { k: "Facet center", v: "offset (0, 1.4)" },
            { k: "Bounding box", v: "24.2 × 18.8 ft" },
            { k: "Eave / Ridge", v: "24.2 / 19.6 ft" },
            { k: "Hip / Valley", v: "— / —" },
            { k: "Rake / Step flash", v: "12.4 / — ft" },
          ].map((row) => (
            <div key={row.k} className="flex items-center justify-between py-0.5">
              <span className="text-[10.5px] text-muted font-mono">{row.k}</span>
              <span className="text-[10.5px] font-mono font-semibold text-ink">
                {row.v}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* ============================================================ */}
      {/*  3. Faces panel                                               */}
      {/* ============================================================ */}
      <GlassPanel
        id="faces"
        editLayout={editLayout}
        positions={panelPositions}
        onDragStart={handlePanelDragStart}
        className="bg-white/88 text-ink p-4"
        style={{ top: 90, right: 20, width: 290, zIndex: 30 }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] font-mono text-muted tracking-wider uppercase">
            FACES · {selected.length}/{ROOF_FACES.length}
          </span>
        </div>
        <div className="text-[11px] text-muted mb-1">Selected planes</div>
        <div className="text-[13px] font-semibold font-mono mb-3">
          {selectedArea.toLocaleString()} sf
          <span className="text-muted-2 font-normal text-[11px] ml-1">
            of {totalArea.toLocaleString()} sf total
          </span>
        </div>

        {/* Checkbox list */}
        <div className="space-y-0.5">
          {ROOF_FACES.map((face) => {
            const isSel = selected.includes(face.id);
            const isHov = hovered === face.id;

            return (
              <label
                key={face.id}
                className={`flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer transition-colors ${
                  isSel
                    ? "bg-blue-soft"
                    : isHov
                      ? "bg-hair/60"
                      : "hover:bg-hair/40"
                }`}
                onMouseEnter={() => setHovered(face.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(face.id)
                        ? prev.filter((s) => s !== face.id)
                        : [...prev, face.id],
                    )
                  }
                  className="w-3.5 h-3.5 rounded accent-blue cursor-pointer"
                />
                <span className="flex-1 text-[12px] font-medium">{face.label}</span>
                <span className="text-[11px] font-mono text-muted">{face.area} sf</span>
              </label>
            );
          })}
        </div>
      </GlassPanel>

      {/* ============================================================ */}
      {/*  4. Material picker                                           */}
      {/* ============================================================ */}
      <GlassPanel
        id="materials"
        editLayout={editLayout}
        positions={panelPositions}
        onDragStart={handlePanelDragStart}
        className="bg-white/88 text-ink p-4"
        style={{ right: 20, bottom: 90, width: 290, zIndex: 30 }}
      >
        <div className="text-[9.5px] font-mono text-muted tracking-wider uppercase mb-2.5">
          Quick materials
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {(["shingle", "metal", "membrane"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMaterialTab(tab)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-mono border-none cursor-pointer transition-colors ${
                materialTab === tab
                  ? "bg-ink text-white"
                  : "bg-hair/60 text-muted hover:bg-hair"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Material grid */}
        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto">
          {MATERIALS[materialTab].map((mat) => (
            <button
              key={mat.id}
              className="flex flex-col items-start gap-1.5 p-2.5 bg-paper-2 border border-hair rounded-lg cursor-pointer hover:border-blue/40 transition-colors text-left"
            >
              <div
                className="w-full h-6 rounded"
                style={{ backgroundColor: mat.swatch }}
              />
              <div>
                <div className="text-[11px] font-semibold leading-tight">{mat.name}</div>
                <div className="text-[10px] text-muted leading-tight">{mat.sub}</div>
              </div>
              <div className="text-[10px] font-mono font-semibold text-blue">
                {mat.price}/sf
              </div>
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* ============================================================ */}
      {/*  5. Tool palette                                              */}
      {/* ============================================================ */}
      <div
        className="absolute z-40 flex items-center gap-1 py-2 px-3 bg-white/10 backdrop-blur-2xl rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)]"
        style={{ bottom: 80, left: "50%", transform: "translateX(-50%)" }}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer transition-colors ${
              activeTool === tool.id
                ? "bg-white/20 text-white"
                : "bg-transparent text-white/55 hover:text-white/80 hover:bg-white/8"
            }`}
          >
            <span className="text-[16px] leading-none">{tool.icon}</span>
            <span className="text-[9px]">{tool.label}</span>
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-8 bg-white/12 mx-1" />

        {/* Undo / Reset */}
        <button
          title="Undo"
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white/55 hover:text-white/80 hover:bg-white/8 transition-colors"
        >
          <span className="text-[16px] leading-none">↩</span>
          <span className="text-[9px]">Undo</span>
        </button>
        <button
          onClick={() => setSelected([])}
          title="Reset"
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer bg-transparent text-white/55 hover:text-white/80 hover:bg-white/8 transition-colors"
        >
          <span className="text-[16px] leading-none">⟲</span>
          <span className="text-[9px]">Reset</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-white/12 mx-1" />

        {/* Edit Layout toggle */}
        <button
          onClick={() => setEditLayout((v) => !v)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border-none cursor-pointer transition-colors ${
            editLayout
              ? "bg-blue/30 text-blue-bright"
              : "bg-transparent text-white/55 hover:text-white/80 hover:bg-white/8"
          }`}
        >
          <span className="text-[16px] leading-none">⊞</span>
          <span className="text-[9px]">Layout</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/*  6. Mode bar                                                  */}
      {/* ============================================================ */}
      <div
        className="absolute z-40 flex items-center gap-1 p-1 bg-white/10 backdrop-blur-2xl rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.10)]"
        style={{ bottom: 24, left: "50%", transform: "translateX(-50%)" }}
      >
        {(["abstract", "satellite", "topdown"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold font-mono border-none cursor-pointer transition-colors ${
              mode === m
                ? "bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                : "bg-transparent text-white/60 hover:text-white/85"
            }`}
          >
            {m === "topdown" ? "Top-down" : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  7. Ask Crew FAB                                              */}
      {/* ============================================================ */}
      <button
        className="absolute z-40 flex items-center gap-2 py-2.5 px-4 rounded-xl border-none cursor-pointer text-white text-[12.5px] font-semibold font-sans shadow-[0_4px_20px_rgba(56,104,198,0.35)]"
        style={{
          right: 20,
          bottom: 24,
          background: "linear-gradient(135deg, #4C85E5 0%, #3868C6 100%)",
        }}
      >
        Ask Crew
        <kbd className="font-mono text-[10px] text-white/70 bg-white/15 py-0.5 px-1.5 rounded ml-1">
          ⌘K
        </kbd>
      </button>

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
