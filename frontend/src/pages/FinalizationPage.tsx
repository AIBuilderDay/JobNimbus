import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import BrandMark from "../components/ui/BrandMark";
import GlassNav, {
  NavDivider,
  NavMeta,
  SavedIndicator,
  NavIconButton,
} from "../components/ui/GlassNav";
import StepCrumbs from "../components/ui/StepCrumbs";
import { useEstimatorStore } from "../store/estimatorStore";
import { useAutoSync } from "../hooks/useAutoSync";
import { usePricing } from "../hooks/usePricing";


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

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function FinalizationPage() {
  const navigate = useNavigate();
  const { address, estimateId, proposalState, pricingState } = useEstimatorStore();
  const { isSyncing, lastSyncedAt } = useAutoSync();
  const { data: pricing } = usePricing(estimateId);
  const totalDisplay = pricing ? fmtUSD(pricing.customer_total_cents) : "$25,582";
  const recipientEmail = proposalState.recipient || "maria.delgado@gmail.com";
  const marginDisplay = pricing ? `${pricing.margin_pct}%` : `${pricingState.marginPct}%`;

  const timelineEvents: TimelineEvent[] = [
    {
      title: "Email delivered",
      sub: recipientEmail,
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
      sub: `${totalDisplay} · ${marginDisplay} margin · 30-day hold`,
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
        <Link to="/" className="shrink-0">
          <BrandMark size={32} />
        </Link>

        <NavDivider />
        <NavMeta label="PROPERTY" value={address ?? "No address selected"} />
        <NavDivider />
        <StepCrumbs current={5} completed />
        <NavDivider />
        <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />
        <NavDivider />
        <NavIconButton icon="list" tooltip="All estimates" onClick={() => navigate("/estimates")} />
        <NavIconButton icon="add" tooltip="New estimate" variant="primary" onClick={() => navigate("/address")} />
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
                  {recipientEmail}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  CUSTOMER TOTAL
                </div>
                <div className="text-[13px] font-semibold text-ink mt-1">
                  {totalDisplay}
                </div>
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

        </div>
      </main>
    </DarkLayout>
  );
}
