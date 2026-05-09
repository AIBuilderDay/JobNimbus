import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import GlassNav from "../components/ui/GlassNav";
import BrandMark from "../components/ui/BrandMark";
import { useProperties } from "../hooks/useEstimates";
import { startEstimate } from "../api/estimates";
import type { Property } from "../types/estimate";

/* ------------------------------------------------------------------ */
/*  Nav step dots                                                      */
/* ------------------------------------------------------------------ */

const navSteps = [
  { num: 1, label: "Address", active: true },
  { num: 2, label: "Capture", active: false },
  { num: 3, label: "Faces", active: false },
  { num: 4, label: "Materials", active: false },
  { num: 5, label: "Proposal", active: false },
];

function StepDots() {
  return (
    <div className="flex items-center gap-5">
      {navSteps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2">
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
        </div>
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

function GeoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2" />
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

const loadingSteps = [
  "Locking imagery...",
  "Snapping to parcel boundary...",
  "Detecting roof planes...",
  "Generating 3D model...",
  "Opening estimator...",
];

function LoadingOverlay({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex < loadingSteps.length - 1) {
      const timer = setTimeout(() => setStepIndex((i) => i + 1), 1200);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [stepIndex, onComplete]);

  const progress = ((stepIndex + 1) / loadingSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-[999] bg-[#0e1830] flex flex-col items-center justify-center">
      {/* radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(76,133,229,0.15),transparent_60%)]" />

      {/* scan animation */}
      <div className="relative w-20 h-20 mb-10">
        <div className="absolute inset-0 rounded-2xl border border-blue-bright/30" />
        <div className="absolute inset-2 rounded-xl border border-blue-bright/20" />
        {/* scanning line */}
        <div className="absolute left-2 right-2 h-px bg-blue-bright/80 shadow-[0_0_12px_rgba(76,133,229,0.6)] animate-[scan_2s_ease-in-out_infinite]" />
        {/* house icon in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <BrandMark size={32} />
        </div>
      </div>

      <div className="relative z-10 text-center">
        <p className="text-[14px] font-medium text-white mb-3">{loadingSteps[stepIndex]}</p>
        {/* progress bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto mb-4">
          <div
            className="h-full bg-blue-bright rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
          Step {stepIndex + 1} of {loadingSteps.length}
        </p>
      </div>

      {/* inline keyframes for scan animation */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 8px; }
          50% { top: calc(100% - 8px); }
        }
      `}</style>
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

  const selectProperty = useCallback(
    async (property: Property) => {
      setIsOpen(false);
      setLoading(true);

      const addressString = `${property.line1}, ${property.line2}`;
      try {
        const result = await startEstimate(addressString);
        console.log("Backend estimate result:", result);
        sessionStorage.setItem("latest-estimate", JSON.stringify(result));
      } catch (e) {
        console.error("Failed to call backend:", e);
      }
    },
    [],
  );

  const handleLoadingComplete = useCallback(() => {
    navigate("/estimator");
  }, [navigate]);

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
    return <LoadingOverlay onComplete={handleLoadingComplete} />;
  }

  return (
    <DarkLayout>
      {/* ---- NAV ---- */}
      <div className="pt-4">
        <GlassNav variant="dark" minWidth={1180}>
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={30} />
            <span className="text-[15px] font-semibold tracking-[-0.3px] text-white">Crew</span>
          </Link>

          <div className="w-px h-6.5 bg-white/12 ml-3" />

          <div className="ml-3">
            <StepDots />
          </div>

          <div className="flex-1" />

          <Link
            to="/"
            className="py-2.5 px-3 bg-transparent text-white/85 border border-white/15 rounded-[10px] text-[12.5px] font-semibold no-underline font-sans hover:bg-white/5 transition-colors"
          >
            Back
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
              <button
                className="p-2 text-muted-2 hover:text-ink bg-transparent border-none cursor-pointer rounded-lg hover:bg-ink/[0.04] transition-colors"
                title="Use my location"
              >
                <GeoIcon />
              </button>
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
                    className={`w-full flex items-start gap-3 px-5 py-3.5 text-left bg-transparent border-none cursor-pointer transition-colors font-sans ${
                      activeIndex === i ? "bg-blue-soft" : "hover:bg-paper-2"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <PinIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-ink/80 truncate">
                        <HighlightMatch text={prop.line1} query={query} />
                      </div>
                      <div className="text-[12px] text-muted-2 mt-0.5 truncate">{prop.line2}</div>
                      <div className="text-[10.5px] font-mono text-muted-2/70 mt-0.5">{prop.parcel}</div>
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

                {/* footer with keyboard hints */}
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
            )}
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
