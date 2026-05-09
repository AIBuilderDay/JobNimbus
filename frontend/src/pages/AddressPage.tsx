import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import GlassNav from "../components/ui/GlassNav";
import BrandMark from "../components/ui/BrandMark";
import Scene from "../components/Scene";
import { useProperties } from "../hooks/useEstimates";
import { startEstimate } from "../api/estimate";
import { captureImages, confirmGeneration, pollModelStatus, getModelUrl } from "../api/model3d";
import { useEstimatorStore } from "../store/estimatorStore";
import { toast } from "sonner";
import type { Property } from "../types/estimate";

/* ------------------------------------------------------------------ */
/*  Nav step dots                                                      */
/* ------------------------------------------------------------------ */

const navSteps = [
  { num: 1, label: "Address", active: true, path: "/address" },
  { num: 2, label: "Materials", active: false, path: "/estimator" },
  { num: 3, label: "Proposal", active: false, path: "/proposal" },
  { num: 4, label: "Finalize", active: false, path: "/finalization" },
];

function StepDots() {
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-5">
      {navSteps.map((step, i) => (
        <button
          key={step.num}
          onClick={() => step.active && nav(step.path)}
          disabled={!step.active}
          className={`flex items-center gap-2 bg-transparent border-none p-0 ${step.active ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
        >
          {i > 0 && <div className="w-4 h-px bg-white/12" />}
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
              step.active
                ? "bg-blue-bright text-white"
                : "bg-white/8 text-white/35 border border-white/10"
            }`}
          >
            {step.num}
          </div>
          <span
            className={`text-[11.5px] font-medium ${
              step.active ? "text-white" : "text-white/35"
            }`}
          >
            {step.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#93a0b8" strokeWidth="1.8">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
      <path
        d="M6 1C3.5 1 1.5 3 1.5 5.3C1.5 8.5 6 13 6 13s4.5-4.5 4.5-7.7C10.5 3 8.5 1 6 1z"
        fill="#3868C6"
        opacity="0.2"
      />
      <circle cx="6" cy="5.5" r="1.5" fill="#3868C6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading overlay                                                    */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  starting: "Starting estimate...",
  pending: "Queuing 3D model...",
  capturing: "Capturing building images...",
  generating: "Generating 3D model...",
  completed: "Opening estimator...",
};

function LoadingSpinner({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? "Loading...";
  return (
    <div className="fixed inset-0 z-[999] bg-[#0e1830] flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(76,133,229,0.15),transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-10 h-10 border-[3px] border-blue-bright border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] font-medium text-white">{label}</p>
      </div>
    </div>
  );
}

function ImageReviewOverlay({
  images,
  onConfirm,
  onCancel,
}: {
  images: string[];
  onConfirm: (selectedIndices: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(images.map((_, i) => i)));

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[999] bg-[#0e1830] flex flex-col items-center justify-center p-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(76,133,229,0.15),transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-[900px] w-full">
        <div className="text-center">
          <h2 className="text-[22px] font-semibold text-white mb-2">Review Captured Images</h2>
          <p className="text-[13px] text-white/50">
            These images will be sent to generate the 3D model. Deselect any that don't show the building.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-h-[60vh] overflow-y-auto p-1">
          {images.map((b64, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-transparent p-0 ${
                selected.has(i)
                  ? "border-blue-bright shadow-[0_0_12px_rgba(76,133,229,0.4)]"
                  : "border-white/10 opacity-40"
              }`}
            >
              <img
                src={`data:image/jpeg;base64,${b64}`}
                alt={`Captured view ${i + 1}`}
                className="w-full aspect-square object-cover"
              />
              <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[14px] ${
                selected.has(i) ? "bg-blue-bright text-white" : "bg-black/50 text-white/40"
              }`}>
                {selected.has(i) ? "✓" : ""}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                <span className="text-[10px] font-mono text-white/70">
                  {i < images.length - 1 ? `Street View ${i + 1}` : "Satellite"}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-white/20 bg-transparent text-white/70 text-[13px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected).sort())}
            disabled={selected.size === 0}
            className="px-5 py-2.5 rounded-xl border-none bg-blue-bright text-white text-[13px] font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Generate with {selected.size} image{selected.size !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Highlight matched text in suggestion                               */
/* ------------------------------------------------------------------ */

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-ink font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent chips                                                       */
/* ------------------------------------------------------------------ */

const recentChips = [
  { label: "412 W Holloway Ave", est: "EST-2418" },
  { label: "1842 Bayshore Blvd", est: "EST-2412" },
  { label: "4920 N Florida Ave", est: "EST-2415" },
];

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function AddressPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: properties = [] } = useProperties(query);

  /* Open dropdown whenever we have results or query changes */
  useEffect(() => {
    setIsOpen(query.length > 0 || properties.length > 0);
    setActiveIndex(-1);
  }, [query, properties.length]);

  /* Scroll active item into view */
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-suggestion]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const { location, buildingInsights, setLocation, setSatelliteImageUrl, setBuildingInsights, setEstimateId, setModelStatus, setModelUrl } = useEstimatorStore();
  const [loadingStatus, setLoadingStatus] = useState("starting");
  const [reviewImages, setReviewImages] = useState<string[] | null>(null);
  const estimateRef = useRef<{ estimateId: string } | null>(null);

  const selectProperty = useCallback(
    async (property: Property) => {
      setIsOpen(false);
      setLoading(true);
      setLoadingStatus("starting");

      try {
        const fullAddress = `${property.line1}, ${property.line2}`;
        const result = await startEstimate(fullAddress);

        if (!result.buildingInsights) {
          toast.error("Solar data unavailable", {
            description: "Could not retrieve solar/roof data for this address. Please try a different address.",
          });
          setLoading(false);
          return;
        }

        setLocation(result.location, result.address);
        setSatelliteImageUrl(result.satelliteImageUrl);
        setBuildingInsights(result.buildingInsights);
        setEstimateId(result.estimateId);
        estimateRef.current = { estimateId: result.estimateId };

        setLoadingStatus("capturing");
        const captured = await captureImages(result.estimateId, result.location.lat, result.location.lng);

        setReviewImages(captured.images);
        setLoadingStatus("review");
      } catch (err) {
        console.error("Failed to load building data:", err);
        toast.error("Estimate failed", {
          description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        });
        setLoading(false);
      }
    },
    [setLocation, setSatelliteImageUrl, setBuildingInsights, setEstimateId, navigate],
  );

  const handleConfirmImages = useCallback(
    async (selectedIndices: number[]) => {
      const eid = estimateRef.current?.estimateId;
      if (!eid) return;

      setReviewImages(null);
      setLoadingStatus("generating");

      try {
        await confirmGeneration(eid, selectedIndices);

        const poll = async (): Promise<void> => {
          const status = await pollModelStatus(eid);
          setLoadingStatus(status.status);
          setModelStatus(status.status);

          if (status.status === "completed") {
            setModelUrl(getModelUrl(eid));
            navigate("/estimator");
          } else if (status.status === "failed") {
            toast.error("3D model failed", { description: status.error ?? "Generation failed" });
            navigate("/estimator");
          } else {
            await new Promise((r) => setTimeout(r, 2000));
            return poll();
          }
        };
        await poll();
      } catch (err) {
        console.error("Generation failed:", err);
        toast.error("Generation failed", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
        setLoading(false);
      }
    },
    [setModelStatus, setModelUrl, navigate],
  );

  const handleCancelReview = useCallback(() => {
    setReviewImages(null);
    setLoading(false);
    setLoadingStatus("starting");
  }, []);

  /* Keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || properties.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i < properties.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : properties.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && properties[activeIndex]) {
          selectProperty(properties[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  /* Cmd+K focus */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const noop = useCallback(() => {}, []);

  if (loading) {
    if (reviewImages) {
      return (
        <ImageReviewOverlay
          images={reviewImages}
          onConfirm={handleConfirmImages}
          onCancel={handleCancelReview}
        />
      );
    }
    return (
      <>
        {location && (
          <div className="fixed inset-0 z-0 opacity-0 pointer-events-none">
            <Scene
              location={location}
              buildingInsights={buildingInsights}
              selectedIndex={-1}
              onSelectSegment={noop}
              onCreditsUpdate={noop}
            />
          </div>
        )}
        <LoadingSpinner status={loadingStatus} />
      </>
    );
  }

  return (
    <DarkLayout>
      {/* ---- NAV ---- */}
      <div className="pt-4">
        <GlassNav variant="dark" minWidth={1180}>
          <Link to="/" className="flex items-center no-underline">
            <BrandMark size={30} />
          </Link>

          <div className="w-px h-6.5 bg-white/12 ml-3" />

          <div className="flex-1 flex justify-center">
            <StepDots />
          </div>

          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 bg-transparent border border-white/15 rounded-[10px] no-underline hover:bg-white/5 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </GlassNav>
      </div>

      {/* ---- CONTENT ---- */}
      <main className="relative z-[2] max-w-[640px] mx-auto px-6 pt-28 pb-20">
        {/* eyebrow */}
        <div className="text-center mb-4">
          <span className="text-[10.5px] font-mono text-white/40 uppercase tracking-[0.15em]">
            NEW ESTIMATE &middot; STEP 1 OF 5
          </span>
        </div>

        {/* heading */}
        <h1 className="font-serif text-[48px] leading-[1.05] font-normal tracking-[-1.2px] text-white text-center mb-4">
          What roof are we{" "}
          <em className="italic text-[#94b6f0]">measuring?</em>
        </h1>

        {/* lede */}
        <p className="text-[15px] leading-[1.65] text-white/50 text-center max-w-[440px] mx-auto mb-10">
          Type a US street address. We'll pull satellite imagery and lock the parcel
          boundary automatically.
        </p>

        {/* ---- SEARCH CARD ---- */}
        <div className="relative">
          <div
            className={`bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden ${
              isOpen && properties.length > 0 ? "rounded-b-2xl" : ""
            }`}
          >
            {/* input row */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-hair">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsOpen(true)}
                className="flex-1 bg-transparent border-none outline-none text-ink font-sans text-[15px] placeholder:text-muted-2"
                placeholder="Enter a street address..."
                autoFocus
              />
              <kbd className="font-mono text-[10.5px] text-muted-2 bg-paper-2 py-1 px-2 rounded-md border border-hair">
                &#8984;K
              </kbd>
            </div>

            {/* suggestions list */}
            {isOpen && properties.length > 0 && (
              <div ref={listRef} className="max-h-[320px] overflow-y-auto">
                {properties.map((prop, i) => (
                  <button
                    key={prop.id}
                    data-suggestion
                    onClick={() => selectProperty(prop)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`group w-full flex items-start gap-3 px-5 py-3.5 text-left border-none cursor-pointer transition-colors font-sans ${
                      activeIndex === i ? "bg-blue-100" : "bg-transparent hover:bg-blue-100"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <PinIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-ink/80 truncate">
                        <HighlightMatch text={prop.line1} query={query} />
                      </div>
                      <div className="text-[12px] text-muted-2 mt-0.5 truncate">{prop.line2.split(" · ")[0]}</div>
                    </div>
                    {prop.tag && prop.tagLabel && (
                      <span
                        className={`shrink-0 mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          prop.tag === "recent"
                            ? "bg-blue-soft text-blue"
                            : "bg-green/10 text-green"
                        }`}
                      >
                        {prop.tag === "recent" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue" />
                        )}
                        {prop.tag === "imagery" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green" />
                        )}
                        {prop.tagLabel}
                      </span>
                    )}
                  </button>
                ))}

              </div>
            )}

            {/* keyboard hints — always visible */}
            <div className="flex items-center gap-4 px-5 py-2.5 border-t border-hair bg-paper-2/50">
              <div className="flex items-center gap-1.5">
                <kbd className="font-mono text-[9px] text-muted-2 bg-white py-0.5 px-1.5 rounded border border-hair shadow-sm">
                  &uarr;
                </kbd>
                <kbd className="font-mono text-[9px] text-muted-2 bg-white py-0.5 px-1.5 rounded border border-hair shadow-sm">
                  &darr;
                </kbd>
                <span className="text-[10px] text-muted-2 ml-0.5">navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="font-mono text-[9px] text-muted-2 bg-white py-0.5 px-1.5 rounded border border-hair shadow-sm">
                  &crarr;
                </kbd>
                <span className="text-[10px] text-muted-2 ml-0.5">select</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="font-mono text-[9px] text-muted-2 bg-white py-0.5 px-1.5 rounded border border-hair shadow-sm">
                  esc
                </kbd>
                <span className="text-[10px] text-muted-2 ml-0.5">close</span>
              </div>
            </div>
          </div>
        </div>

        {/* ---- RECENT CHIPS ---- */}
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <span className="text-[10.5px] font-mono text-white/30 uppercase tracking-wider mr-1">Recent</span>
          {recentChips.map((chip) => (
            <button
              key={chip.est}
              onClick={() => setQuery(chip.label)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/6 border border-white/10 rounded-lg text-[12px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors cursor-pointer font-sans"
            >
              <span className="truncate max-w-[140px]">{chip.label}</span>
              <span className="text-[10px] font-mono text-white/30">{chip.est}</span>
            </button>
          ))}
        </div>
      </main>
    </DarkLayout>
  );
}
