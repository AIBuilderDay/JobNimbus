import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import BrandMark from "../components/ui/BrandMark";
import GlassNav, {
  NavDivider,
  NavMeta,
  SavedIndicator,
  NavGhostButton,
  NavPrimaryButton,
} from "../components/ui/GlassNav";

/* ------------------------------------------------------------------ */
/*  Completed step crumbs (all green)                                  */
/* ------------------------------------------------------------------ */

const steps = [
  { n: 1, label: "Address", path: "/address" },
  { n: 2, label: "Capture", path: "/estimator" },
  { n: 3, label: "Facets", path: "/estimator" },
  { n: 4, label: "Pricing", path: "/pricing" },
  { n: 5, label: "Proposal", path: "/proposal" },
];

function CompletedCrumbs() {
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s) => (
        <button
          key={s.n}
          onClick={() => nav(s.path)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold font-mono whitespace-nowrap cursor-pointer border-none hover:opacity-80 transition-opacity"
          style={{
            background: "rgba(58,166,118,0.18)",
            color: "#6fdba6",
            boxShadow: "inset 0 0 0 1px rgba(58,166,118,0.25)",
          }}
        >
          &#10003; {s.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline event                                                     */
/* ------------------------------------------------------------------ */

interface TimelineEvent {
  title: string;
  sub: string;
  time: string;
  variant: "pulse" | "check";
}

function TimelineDot({ variant }: { variant: "pulse" | "check" }) {
  if (variant === "pulse") {
    return (
      <span className="relative flex items-center justify-center w-3 h-3 shrink-0">
        <span className="absolute w-3 h-3 rounded-full bg-blue-bright/30 animate-ping" />
        <span className="w-2 h-2 rounded-full bg-blue-bright" />
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-3 h-3 rounded-full bg-green shrink-0">
      <svg width="8" height="8" viewBox="0 0 8 8">
        <path
          d="M1.5 4 L3.2 5.8 L6.5 2.2"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Dot + line */}
      <div className="flex flex-col items-center pt-1">
        <TimelineDot variant={event.variant} />
        {!isLast && (
          <div className="w-px flex-1 bg-white/10 mt-1.5" />
        )}
      </div>
      {/* Content */}
      <div className="pb-5">
        <div className="text-[13px] font-semibold text-white leading-tight">
          {event.title}
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">{event.sub}</div>
        <div className="text-[10px] font-mono text-white/35 mt-1">
          {event.time}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Next step item                                                     */
/* ------------------------------------------------------------------ */

function NextStep({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
}) {
  return (
    <button className="flex items-center gap-3.5 p-3.5 rounded-xl border border-hair hover:bg-blue-soft/40 transition-colors cursor-pointer bg-transparent text-left w-full">
      <div className="w-9 h-9 rounded-lg bg-blue-soft flex items-center justify-center shrink-0 text-blue">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-ink">{name}</div>
        <div className="text-[11px] text-muted mt-0.5">{description}</div>
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="#93a0b8"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M5 3 L9 7 L5 11" />
      </svg>
    </button>
  );
}

/* ================================================================== */
/*  FinalizationPage                                                   */
/* ================================================================== */

export default function FinalizationPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const shareLink = "crew.app/p/EST-2418-d3f9";

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${shareLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timelineEvents: TimelineEvent[] = [
    {
      title: "Email delivered",
      sub: "maria.delgado@gmail.com",
      time: "09:21 AM · just now",
      variant: "pulse",
    },
    {
      title: "Proposal generated",
      sub: "PDF + interactive link created",
      time: "09:21 AM · just now",
      variant: "check",
    },
    {
      title: "Pricing locked",
      sub: "$25,582 · 38% margin · 30-day hold",
      time: "09:20 AM",
      variant: "check",
    },
    {
      title: "6 facets confirmed",
      sub: "22.4 sq · Estate Gray · GAF certified",
      time: "09:18 AM",
      variant: "check",
    },
  ];

  return (
    <DarkLayout>
      {/* Nav */}
      <GlassNav>
        <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
          <BrandMark size={32} />
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-white leading-tight">
              Holloway re-roof
            </span>
            <span className="text-[10.5px] font-mono text-white/50">
              EST-2418 &middot; Sent
            </span>
          </div>
        </Link>

        <NavDivider />
        <NavMeta label="PROPERTY" value="412 W Holloway Ave · Tampa, FL" />
        <NavDivider />
        <CompletedCrumbs />
        <NavDivider />
        <SavedIndicator text="Delivered" />
        <NavDivider />
        <NavGhostButton onClick={() => navigate("/estimates")}>
          All estimates
        </NavGhostButton>
        <NavPrimaryButton onClick={() => navigate("/address")}>
          Start a new estimate
        </NavPrimaryButton>
      </GlassNav>

      {/* Body */}
      <main
        className="relative z-[2] max-w-[1180px] mx-auto px-6 pt-14 pb-20 grid gap-7"
        style={{ gridTemplateColumns: "1.05fr 1fr" }}
      >
        {/* ---- LEFT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Hero card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-8 flex flex-col items-start">
            {/* Green check */}
            <div className="w-16 h-16 rounded-full bg-green flex items-center justify-center mb-5">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M9 16.5 L14 21.5 L23 11"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Eyebrow */}
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">
              PROPOSAL DELIVERED &middot; 09:21 AM
            </div>

            {/* Title */}
            <h1 className="font-serif text-[42px] leading-[1.06] font-normal tracking-[-1px] text-ink">
              It&rsquo;s in Maria&rsquo;s{" "}
              <em className="italic text-blue">inbox.</em>
            </h1>

            {/* Lede */}
            <p className="text-[14px] text-muted leading-relaxed mt-3 max-w-[420px]">
              Maria will receive a branded proposal with an interactive viewer
              and e-signature. A signed copy returns to your dashboard
              automatically. Pricing is locked for 30 days.
            </p>

            {/* Stat grid */}
            <div className="grid grid-cols-3 gap-5 mt-7 w-full border-t border-hair pt-5">
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  SENT TO
                </div>
                <div className="text-[13px] font-semibold text-ink mt-1 break-all">
                  maria.delgado@gmail.com
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  CUSTOMER TOTAL
                </div>
                <div className="text-[13px] font-semibold text-ink mt-1">
                  $25,582
                </div>
                <div className="text-[11px] text-muted">$336/mo</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  VALID THROUGH
                </div>
                <div className="text-[13px] font-semibold text-ink mt-1">
                  Apr 13, 2025
                </div>
              </div>
            </div>

            {/* CTA row */}
            <div className="flex items-center gap-3 mt-7">
              <button className="py-2.5 px-5 bg-blue text-white rounded-xl text-[13px] font-semibold cursor-pointer border-none hover:bg-blue-bright transition-colors">
                View as homeowner
              </button>
              <button className="py-2.5 px-4 bg-transparent text-ink border border-hair rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-blue-soft/40 transition-colors">
                Download PDF
              </button>
              <button className="py-2.5 px-4 bg-transparent text-ink border border-hair rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-blue-soft/40 transition-colors">
                Share with crew
              </button>
            </div>
          </div>
        </div>

        {/* ---- RIGHT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Timeline card */}
          <div className="rounded-2xl p-5 bg-white/8 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_20px_rgba(0,0,0,0.2)] backdrop-blur-xl border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[14px] font-semibold text-white">
                Activity timeline
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_0_3px_rgba(95,211,154,0.2)]" />
                Live &middot; auto-refreshes
              </div>
            </div>

            {timelineEvents.map((event, i) => (
              <TimelineItem
                key={i}
                event={event}
                isLast={i === timelineEvents.length - 1}
              />
            ))}
          </div>

          {/* Next steps card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-5">
            <div className="text-[14px] font-semibold text-ink mb-4">
              Next steps
            </div>
            <div className="flex flex-col gap-2">
              <NextStep
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="2"
                      y="3"
                      width="12"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M2 7h12M5 1v4M11 1v4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
                name="Schedule install"
                description="Book a crew date once Maria signs"
              />
              <NextStep
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="3"
                      y="2"
                      width="10"
                      height="12"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M6 5h4M6 8h4M6 11h2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
                name="File permit"
                description="Hillsborough County roofing permit"
              />
              <NextStep
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8 4.5V8l2.5 2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
                name="Set follow-up reminder"
                description="Nudge if unsigned after 5 days"
              />
            </div>
          </div>

          {/* Share link card */}
          <div className="rounded-2xl p-4 border-2 border-dashed border-white/15 bg-white/5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono text-white/45 uppercase tracking-wider mb-1">
                SHAREABLE LINK
              </div>
              <div className="text-[13px] font-mono text-white/80">
                {shareLink}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="py-2 px-4 rounded-lg bg-white/10 text-white text-[12px] font-semibold cursor-pointer border border-white/15 hover:bg-white/15 transition-colors shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </main>
    </DarkLayout>
  );
}
