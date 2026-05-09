import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import GlassNav, { NavIconButton, SavedIndicator } from "../components/ui/GlassNav";
import BrandMark from "../components/ui/BrandMark";
import StepCrumbs from "../components/ui/StepCrumbs";
import Scene from "../components/Scene";
import { useProperties } from "../hooks/useEstimates";
import { startEstimate } from "../api/estimate";
import { useEstimatorStore } from "../store/estimatorStore";
import { toast } from "sonner";
import type { Property } from "../types/estimate";
import { useAutoSync } from "../hooks/useAutoSync";

const ADDRESS_STEPS = [
  { n: 1, label: "Address", path: "/address" },
  { n: 2, label: "Materials", path: "/estimator" },
  { n: 3, label: "Proposal", path: "/proposal" },
  { n: 4, label: "Finalize", path: "/finalization" },
];

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

function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-[999] bg-[#0e1830] flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(76,133,229,0.15),transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-10 h-10 border-[3px] border-blue-bright border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] font-medium text-white">Starting estimate...</p>
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
  const { isSyncing, lastSyncedAt, syncNow } = useAutoSync();

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

  const { location, buildingInsights, setLocation, setSatelliteImageUrl, setBuildingInsights, setEstimateId } = useEstimatorStore();

  const noop = useCallback(() => {}, []);

  const selectProperty = useCallback(
    async (property: Property) => {
      setIsOpen(false);
      setLoading(true);

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
        syncNow();
        navigate("/estimator");
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

  if (loading) {
    return (
      <>
        {location && (
          <div className="fixed inset-0 z-0 opacity-0 pointer-events-none">
            <Scene
              location={location}
              buildingInsights={buildingInsights}
              selectedIndices={[]}
              onToggleSegment={noop}
              onClearSegments={noop}
              onCreditsUpdate={noop}
            />
          </div>
        )}
        <LoadingSpinner />
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

          <div className="flex-1 flex justify-center">
            <StepCrumbs current={1} steps={ADDRESS_STEPS} />
          </div>

          <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />
          <NavIconButton icon="arrow_back" tooltip="Back" onClick={() => navigate("/")} />
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
