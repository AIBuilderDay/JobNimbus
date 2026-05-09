import { Link } from "react-router-dom";
import GlassNav from "../components/ui/GlassNav";
import BrandMark from "../components/ui/BrandMark";

/* ------------------------------------------------------------------ */
/*  Tiny reusable bits                                                 */
/* ------------------------------------------------------------------ */

function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7h12M8 2l5 5-5 5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 2l8.5 5-8.5 5V2z" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Fake avatar stack                                                  */
/* ------------------------------------------------------------------ */

const avatarColors = ["#3868C6", "#4C85E5", "#3aa676", "#d99344", "#6b7a96"];

function AvatarStack() {
  return (
    <div className="flex items-center">
      {avatarColors.map((bg, i) => (
        <div
          key={i}
          className="w-7 h-7 rounded-full border-2 border-white"
          style={{ background: bg, marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero illustration: isometric house on dark card                    */
/* ------------------------------------------------------------------ */

function HeroCard() {
  return (
    <div className="relative w-full max-w-[560px] aspect-[560/480] rounded-3xl bg-[linear-gradient(160deg,#1a2440_0%,#0e1830_100%)] overflow-hidden shadow-[0_32px_80px_rgba(14,24,48,0.45)]">
      {/* grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_90%)]" />

      {/* isometric house SVG */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width="220" height="200" viewBox="0 0 220 200" fill="none" className="drop-shadow-lg">
          {/* roof left */}
          <path d="M110 30 L30 90 L110 70 Z" fill="#3868C6" opacity="0.85" />
          {/* roof right */}
          <path d="M110 30 L190 90 L110 70 Z" fill="#4C85E5" opacity="0.85" />
          {/* wall left */}
          <path d="M30 90 L110 70 L110 160 L30 140 Z" fill="#1a2440" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          {/* wall right */}
          <path d="M190 90 L110 70 L110 160 L190 140 Z" fill="#152952" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          {/* door */}
          <rect x="98" y="120" width="24" height="40" rx="2" fill="#0e1830" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
          {/* animated dashed selection outline */}
          <path
            d="M110 24 L24 88 L24 144 L110 166 L196 144 L196 88 Z"
            fill="none"
            stroke="#4C85E5"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.7"
          >
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1.5s" repeatCount="indefinite" />
          </path>
        </svg>
      </div>

      {/* floating stat chips */}
      <div className="absolute top-6 right-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-lg px-3 py-2 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#5fd39a]" />
          <span className="text-[11px] font-mono text-white/80">22.4 sq detected</span>
        </div>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-lg px-3 py-2 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-blue-bright" />
          <span className="text-[11px] font-mono text-white/80">6 roof planes</span>
        </div>
      </div>

      {/* bottom stat card */}
      <div className="absolute bottom-5 left-5 right-5 flex items-center gap-4 bg-white/8 backdrop-blur-xl rounded-xl px-4 py-3 border border-white/10">
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-white/45 uppercase tracking-wider">Total area</span>
          <span className="text-sm font-semibold text-white font-mono">2,240 sf</span>
        </div>
        <div className="w-px h-7 bg-white/12" />
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-white/45 uppercase tracking-wider">Pitch</span>
          <span className="text-sm font-semibold text-white font-mono">4:12</span>
        </div>
        <div className="w-px h-7 bg-white/12" />
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-white/45 uppercase tracking-wider">Est. cost</span>
          <span className="text-sm font-semibold text-white font-mono">$25,582</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step card for "How it works"                                       */
/* ------------------------------------------------------------------ */

const steps = [
  {
    num: "01",
    title: "Capture",
    desc: "Enter any US address. We snap satellite imagery and lock the parcel boundary in under 10 seconds.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#3868C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14" cy="14" r="5" />
        <path d="M14 3v4M14 21v4M3 14h4M21 14h4" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Shape",
    desc: "AI detects every ridge, hip, and valley. Edit planes live or accept the auto-trace. Accuracy within +/-2%.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#3868C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8l10-5 10 5v10l-10 5-10-5V8z" />
        <path d="M4 8l10 5 10-5M14 13v10" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Send",
    desc: "Pick materials, set margin, and send a branded PDF proposal. Homeowners e-sign right from their phone.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#3868C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h20v16H4V6zM4 6l10 9 10-9" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Stats grid                                                         */
/* ------------------------------------------------------------------ */

const stats = [
  { value: "4:12", label: "Average pitch detected", sub: "across 18,000+ roofs" },
  { value: "±2%", label: "Measurement accuracy", sub: "vs. manual takeoff" },
  { value: "38%", label: "Avg. crew margin", sub: "set by our top users" },
  { value: "$0", label: "Per-estimate cost", sub: "unlimited on all plans" },
];

/* ------------------------------------------------------------------ */
/*  Trust strip logos (placeholder)                                    */
/* ------------------------------------------------------------------ */

const logoNames = ["StormGuard", "Apex Roofing", "Vertex Co.", "Summit Crews", "RidgeLine", "TrueNorth"];

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-ink font-sans">
      {/* ---- NAV ---- */}
      <div className="pt-4">
        <GlassNav variant="light" minWidth={1180}>
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={30} />
            <span className="text-[15px] font-semibold tracking-[-0.3px] text-ink">Crew</span>
          </Link>

          <div className="flex items-center gap-1 ml-4">
            {["Product", "Materials", "Pricing", "For crews", "Resources"].map((label) => (
              <button key={label} className="px-3 py-1.5 text-[13px] font-medium text-ink/70 hover:text-ink bg-transparent border-none cursor-pointer rounded-lg hover:bg-ink/[0.04] transition-colors font-sans">
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Link
            to="/estimates"
            className="py-2 px-3 text-[12.5px] font-semibold text-ink/70 hover:text-ink bg-transparent border border-ink/12 rounded-[10px] no-underline transition-colors hover:bg-ink/[0.03] font-sans"
          >
            History
          </Link>
          <Link
            to="/address"
            className="py-2.5 px-3.5 bg-ink text-white border-none rounded-[10px] text-[12.5px] font-semibold no-underline font-sans tracking-tight hover:bg-ink/90 transition-colors"
          >
            Start estimate
          </Link>
        </GlassNav>
      </div>

      {/* ---- HERO ---- */}
      <section className="max-w-[1320px] mx-auto px-6 pt-24 pb-20">
        <div className="flex items-center gap-16 flex-wrap lg:flex-nowrap">
          {/* left */}
          <div className="flex-1 min-w-[380px] max-w-[580px]">
            {/* eyebrow pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-soft border border-blue/10 mb-7">
              <span className="text-[11px] font-mono font-semibold text-blue tracking-wider uppercase">NEW</span>
              <span className="w-px h-3 bg-blue/20" />
              <span className="text-[11px] font-mono text-blue/70 tracking-wide">Satellite measurement v3</span>
            </div>

            <h1 className="font-serif text-[64px] leading-[1.02] font-normal tracking-[-2px] text-ink mb-6">
              Roof estimates in{" "}
              <span className="bg-[linear-gradient(135deg,#3868C6,#4C85E5)] bg-clip-text text-transparent">
                90&nbsp;seconds.
              </span>
            </h1>

            <p className="text-[17px] leading-[1.65] text-muted max-w-[460px] mb-8">
              Enter an address, let AI measure every ridge and valley, then send a
              branded proposal -- all before the homeowner finishes their coffee.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3 mb-10">
              <Link
                to="/address"
                className="inline-flex items-center gap-2.5 py-3.5 px-6 bg-ink text-white rounded-xl text-[14px] font-semibold no-underline hover:bg-ink/90 transition-colors font-sans tracking-tight"
              >
                Start an estimate
                <ArrowRight />
              </Link>
              <button className="inline-flex items-center gap-2.5 py-3.5 px-5 bg-transparent text-ink/70 border border-ink/12 rounded-xl text-[14px] font-semibold cursor-pointer hover:bg-ink/[0.03] transition-colors font-sans">
                <PlayIcon />
                Watch a 90-second demo
              </button>
            </div>

            {/* trust row */}
            <div className="flex items-center gap-3">
              <AvatarStack />
              <span className="text-[13px] text-muted">
                <span className="font-semibold text-ink">3,400+</span> roofing crews use Crew
              </span>
            </div>
          </div>

          {/* right */}
          <div className="flex-1 flex justify-center min-w-[380px]">
            <HeroCard />
          </div>
        </div>
      </section>

      {/* ---- TRUST STRIP ---- */}
      <section className="bg-[#f7f8fa] border-y border-hair">
        <div className="max-w-[1320px] mx-auto px-6 py-8 flex items-center justify-between gap-8 flex-wrap">
          <span className="text-[11px] font-mono text-muted-2 uppercase tracking-wider whitespace-nowrap">
            Trusted by top crews
          </span>
          {logoNames.map((name) => (
            <span key={name} className="text-[15px] font-semibold text-ink/20 tracking-tight whitespace-nowrap">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section className="max-w-[1320px] mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <span className="text-[11px] font-mono text-muted-2 uppercase tracking-wider">How it works</span>
          <h2 className="font-serif text-[42px] leading-[1.1] font-normal tracking-[-1px] text-ink mt-3">
            Three steps. One roof.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="relative bg-white border border-hair rounded-2xl p-8 hover:shadow-[0_8px_30px_rgba(21,41,82,0.06)] transition-shadow"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-soft flex items-center justify-center">
                  {step.icon}
                </div>
                <span className="text-[11px] font-mono text-muted-2 uppercase tracking-wider">{step.num}</span>
              </div>
              <h3 className="text-[20px] font-semibold text-ink mb-2 tracking-tight">{step.title}</h3>
              <p className="text-[14px] leading-[1.65] text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- STATS GRID ---- */}
      <section className="max-w-[1320px] mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.value} className="text-center py-8">
              <div className="font-mono text-[36px] font-bold text-ink tracking-tight mb-1">{s.value}</div>
              <div className="text-[14px] font-semibold text-ink mb-1">{s.label}</div>
              <div className="text-[12px] text-muted-2">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FINAL CTA ---- */}
      <section className="max-w-[1320px] mx-auto px-6 pb-24">
        <div className="relative rounded-3xl bg-[linear-gradient(160deg,#1a2440_0%,#0e1830_100%)] overflow-hidden px-12 py-16 text-center">
          {/* grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_90%)]" />

          <div className="relative z-10">
            <h2 className="font-serif text-[40px] leading-[1.1] font-normal tracking-[-1px] text-white mb-4">
              Pick a house. Watch Crew measure it.
            </h2>
            <p className="text-[15px] text-white/60 mb-8 max-w-[420px] mx-auto">
              No signup required. Enter any US address and see satellite measurement in action.
            </p>
            <Link
              to="/address"
              className="inline-flex items-center gap-2.5 py-3.5 px-7 bg-white text-ink rounded-xl text-[14px] font-semibold no-underline hover:bg-white/90 transition-colors font-sans tracking-tight"
            >
              Start an estimate
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="border-t border-hair">
        <div className="max-w-[1320px] mx-auto px-6 py-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={24} />
            <span className="text-[13px] font-semibold text-ink tracking-tight">Crew</span>
          </div>
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "Support"].map((label) => (
              <a key={label} href="#" className="text-[13px] text-muted hover:text-ink no-underline transition-colors">
                {label}
              </a>
            ))}
          </div>
          <span className="text-[12px] text-muted-2">&copy; 2026 Crew Technologies, Inc.</span>
        </div>
      </footer>
    </div>
  );
}
