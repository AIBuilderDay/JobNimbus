import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import GlassNav, { NavIconButton } from "../components/ui/GlassNav";
import BrandMark from "../components/ui/BrandMark";
import StepCrumbs from "../components/ui/StepCrumbs";

import { useProperties } from "../hooks/useEstimates";
import { startEstimate } from "../api/estimate";
import { useEstimatorStore } from "../store/estimatorStore";
import { toast } from "sonner";
import type { Property } from "../types/estimate";



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
/*  Animated loading overlay                                           */
/* ------------------------------------------------------------------ */

const LOADING_STEPS = [
  { label: "Locating property", icon: "📍" },
  { label: "Pulling satellite imagery", icon: "🛰️" },
  { label: "Analyzing roof segments", icon: "🏠" },
  { label: "Building your estimate", icon: "📐" },
];

function LoadingSpinner({ apiReady, onComplete }: { apiReady: boolean; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finishingRef = useRef(false);
  const stepRef = useRef(0);

  // Normal pace: advance one step every 2.2s
  useEffect(() => {
    if (finishingRef.current) return;
    const id = setInterval(() => {
      setStep((s) => {
        const next = s < LOADING_STEPS.length - 1 ? s + 1 : s;
        stepRef.current = next;
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // When API ready: fast-forward remaining steps then navigate
  useEffect(() => {
    if (!apiReady || finishingRef.current) return;
    finishingRef.current = true;

    let current = stepRef.current;
    const fastForward = setInterval(() => {
      current++;
      if (current >= LOADING_STEPS.length) {
        clearInterval(fastForward);
        setDone(true);
        setTimeout(() => onCompleteRef.current(), 500);
        return;
      }
      stepRef.current = current;
      setStep(current);
    }, 400);

    return () => clearInterval(fastForward);
  }, [apiReady]);

  // Progress bar: tracks step position, smoothly fills within each step
  useEffect(() => {
    const stepTarget = done ? 100 : ((step + 1) / LOADING_STEPS.length) * 100;
    const max = !done && !finishingRef.current && step < LOADING_STEPS.length - 1 ? stepTarget : done ? 100 : stepTarget - 2;

    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= max) return max;
        const speed = finishingRef.current ? 2 : 0.4;
        return Math.min(p + speed, max);
      });
    }, 30);
    return () => clearInterval(tick);
  }, [step, done]);

  return (
    <div className="fixed inset-0 z-[999] bg-[#0e1830] flex flex-col items-center justify-center overflow-hidden">
      {/* Animated background gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(76,133,229,0.12), transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(56,104,198,0.08), transparent 50%)",
        }}
      />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + (i % 3) * 2}px`,
            height: `${2 + (i % 3) * 2}px`,
            background: `rgba(76,133,229,${0.15 + (i % 4) * 0.08})`,
            left: `${5 + (i * 4.7) % 90}%`,
            top: `${10 + (i * 7.3) % 80}%`,
            animation: `float-particle ${4 + (i % 3) * 2}s ease-in-out ${(i % 5) * 0.6}s infinite alternate`,
          }}
        />
      ))}

      {/* Scanning line */}
      <div
        className="absolute left-0 right-0 h-[1px] opacity-20"
        style={{
          background: "linear-gradient(90deg, transparent, #4C85E5, transparent)",
          animation: "scan-line 3s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 flex flex-col items-center w-full max-w-[400px] px-6">
        {/* Pulsing icon */}
        <div
          className="text-[48px] mb-8"
          style={{ animation: "pulse-icon 2s ease-in-out infinite" }}
        >
          {LOADING_STEPS[step].icon}
        </div>

        {/* Current step label */}
        <p
          key={step}
          className="text-[18px] font-medium text-white mb-2 text-center"
          style={{ animation: "fade-up 0.5s ease-out" }}
        >
          {LOADING_STEPS[step].label}
        </p>

        {/* Sub-label */}
        <p className="text-[13px] text-white/40 mb-8 text-center font-mono">
          Step {step + 1} of {LOADING_STEPS.length}
        </p>

        {/* Progress bar */}
        <div className="w-full h-[3px] bg-white/8 rounded-full overflow-hidden mb-6">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #3868C6, #4C85E5, #6da3ff)",
              boxShadow: "0 0 12px rgba(76,133,229,0.5)",
            }}
          />
        </div>

        {/* Step checklist */}
        <div className="flex flex-col gap-3 w-full">
          {LOADING_STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={i}
                className="flex items-center gap-3 transition-all duration-500"
                style={{
                  opacity: done ? 0.5 : active ? 1 : 0.2,
                  transform: active ? "translateX(4px)" : "none",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-all duration-500"
                  style={{
                    background: done
                      ? "rgba(58,166,118,0.25)"
                      : active
                        ? "rgba(76,133,229,0.3)"
                        : "rgba(255,255,255,0.05)",
                    border: done
                      ? "1px solid rgba(58,166,118,0.4)"
                      : active
                        ? "1px solid rgba(76,133,229,0.5)"
                        : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: active ? "0 0 12px rgba(76,133,229,0.3)" : "none",
                  }}
                >
                  {done ? (
                    <span className="text-[#6fdba6]">✓</span>
                  ) : active ? (
                    <div
                      className="w-2 h-2 rounded-full bg-blue-bright"
                      style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }}
                    />
                  ) : (
                    <span className="text-white/20">{i + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[13px] font-medium transition-colors duration-500 ${
                    done ? "text-[#6fdba6]/60" : active ? "text-white" : "text-white/20"
                  }`}
                >
                  {s.label}
                  {done && <span className="text-[#6fdba6]/40 ml-2 text-[11px]">Done</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes float-particle {
          from { transform: translateY(0) scale(1); opacity: 0.3; }
          to { transform: translateY(-20px) scale(1.3); opacity: 0.7; }
        }
        @keyframes scan-line {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
        @keyframes pulse-icon {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 20px rgba(76,133,229,0.4)); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.8); opacity: 0.5; }
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
  const [apiReady, setApiReady] = useState(false);
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

  const { setLocation, setSatelliteImageUrl, setBuildingInsights, setEstimateId } = useEstimatorStore();

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
        setApiReady(true);
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
    return <LoadingSpinner apiReady={apiReady} onComplete={() => navigate("/estimator")} />;
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
            <StepCrumbs current={1} />
          </div>

          <NavIconButton icon="history" tooltip="History" onClick={() => navigate("/estimates")} />
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
