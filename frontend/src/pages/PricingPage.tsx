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
import { useLineItems } from "../hooks/useEstimates";

/* ------------------------------------------------------------------ */
/*  Step crumbs                                                        */
/* ------------------------------------------------------------------ */

const steps = [
  { n: 1, label: "Address" },
  { n: 2, label: "Capture" },
  { n: 3, label: "Facets" },
  { n: 4, label: "Pricing" },
  { n: 5, label: "Proposal" },
];

function StepCrumbs({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s) => {
        const done = s.n < current;
        const active = s.n === current;
        const todo = s.n > current;

        let style: React.CSSProperties = {};
        if (done) {
          style = {
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
          };
        } else if (active) {
          style = {
            background: "rgba(76,133,229,0.22)",
            color: "#fff",
            boxShadow: "inset 0 0 0 1px rgba(76,133,229,0.5)",
          };
        } else if (todo) {
          style = { color: "rgba(255,255,255,0.45)" };
        }

        return (
          <span
            key={s.n}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold font-mono whitespace-nowrap"
            style={style}
          >
            {s.n} {s.label}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="relative shrink-0 cursor-pointer border-none"
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? "#4C85E5" : "#d8e1f1",
        transition: "background .2s",
      }}
    >
      <span
        className="absolute top-[2px] rounded-full bg-white shadow-sm"
        style={{
          width: 16,
          height: 16,
          left: on ? 18 : 2,
          transition: "left .2s",
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const tabLabels = ["Materials", "Labor", "Add-ons", "Disposal & permits"];

function Tabs({
  active,
  onChange,
}: {
  active: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-hair px-5 pt-4">
      {tabLabels.map((t, i) => (
        <button
          key={t}
          onClick={() => onChange(i)}
          className={`pb-3 px-3 text-[13px] font-semibold cursor-pointer border-none bg-transparent ${
            i === active
              ? "text-ink border-b-2 border-blue-bright"
              : "text-muted"
          }`}
          style={
            i === active
              ? { borderBottom: "2px solid #4C85E5", marginBottom: -1 }
              : {}
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Financing option card                                              */
/* ------------------------------------------------------------------ */

function FinancingOption({
  title,
  sub,
  selected,
  onClick,
}: {
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-3.5 cursor-pointer border transition-colors"
      style={{
        background: selected ? "rgba(76,133,229,0.06)" : "#fff",
        borderColor: selected ? "#4C85E5" : "#e6ecf6",
      }}
    >
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>
    </button>
  );
}

/* ================================================================== */
/*  PricingPage                                                        */
/* ================================================================== */

export default function PricingPage() {
  const navigate = useNavigate();
  const { data: lineItems = [] } = useLineItems();

  const [activeTab, setActiveTab] = useState(0);
  const [marginPct, setMarginPct] = useState(38);
  const [toggles, setToggles] = useState([true, true, false]);
  const [financing, setFinancing] = useState([true, true, false, false]);

  const subtotal = 18538.1;
  const grossProfit = Math.round(subtotal * (marginPct / (100 - marginPct)));
  const customerTotal = subtotal + grossProfit;

  const toggleAt = (i: number) =>
    setToggles((p) => p.map((v, j) => (j === i ? !v : v)));
  const toggleFinancing = (i: number) =>
    setFinancing((p) => p.map((v, j) => (j === i ? !v : v)));

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
              EST-2418 &middot; Draft
            </span>
          </div>
        </Link>

        <NavDivider />
        <NavMeta label="PROPERTY" value="412 W Holloway Ave · Tampa, FL" />
        <NavDivider />
        <StepCrumbs current={4} />
        <NavDivider />
        <SavedIndicator text="Saved · just now" />
        <NavDivider />
        <NavGhostButton onClick={() => navigate("/estimator")}>
          Back to canvas
        </NavGhostButton>
        <NavPrimaryButton onClick={() => navigate("/proposal")}>
          Continue &middot; Proposal
        </NavPrimaryButton>
      </GlassNav>

      {/* Body */}
      <main className="relative z-[2] max-w-[1240px] mx-auto px-6 pt-14 pb-20 grid gap-6" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        {/* ---- LEFT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Eyebrow + title */}
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              PRICING &middot; STEP 4 OF 5
            </div>
            <h1 className="font-serif text-[44px] leading-[1.06] font-normal tracking-[-1px] text-white mt-1.5">
              Build the line items.
            </h1>
            <p className="text-[13px] text-white/50 mt-1 font-mono">
              {lineItems.length} lines &middot; auto-generated
            </p>
          </div>

          {/* Line items card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] overflow-hidden">
            <Tabs active={activeTab} onChange={setActiveTab} />

            {/* Table header */}
            <div
              className="grid items-center px-5 py-2.5 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-hair"
              style={{ gridTemplateColumns: "1fr 92px 92px 110px" }}
            >
              <span>ITEM</span>
              <span className="text-right">QTY</span>
              <span className="text-right">UNIT $</span>
              <span className="text-right">TOTAL</span>
            </div>

            {/* Rows */}
            {lineItems.map((item, i) => (
              <div
                key={i}
                className="grid items-center px-5 py-3 border-b border-hair/60 last:border-b-0 hover:bg-blue-soft/40 transition-colors"
                style={{ gridTemplateColumns: "1fr 92px 92px 110px" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="shrink-0 rounded-md"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: item.color,
                    }}
                  />
                  <div>
                    <div className="text-[13px] font-semibold text-ink leading-tight">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {item.detail}
                    </div>
                  </div>
                </div>
                <span className="text-[13px] font-mono text-ink text-right">
                  {item.qty}
                </span>
                <span className="text-[13px] font-mono text-ink text-right">
                  {item.unitPrice}
                </span>
                <span className="text-[13px] font-mono font-semibold text-ink text-right">
                  {item.total}
                </span>
              </div>
            ))}

            {/* Add line */}
            <button className="w-full flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold text-blue cursor-pointer bg-transparent border-none hover:bg-blue-soft/30 transition-colors">
              <span className="text-lg leading-none">+</span> Add line item
            </button>

            {/* Toggles */}
            <div className="border-t border-hair px-5 py-4 flex flex-col gap-3.5">
              {[
                { label: "Manufacturer warranty", init: true },
                { label: "GAF certified", init: true },
                { label: "Solar reflective", init: false },
              ].map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">{t.label}</span>
                  <Toggle on={toggles[i]} onChange={() => toggleAt(i)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- RIGHT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Eyebrow + title */}
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              SUMMARY
            </div>
            <h1 className="font-serif text-[44px] leading-[1.06] font-normal tracking-[-1px] text-white mt-1.5">
              Estimate total.
            </h1>
          </div>

          {/* Totals card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-5 flex flex-col gap-4">
            {/* Subtotal rows */}
            {[
              { label: "Materials", value: "$14,248.10" },
              { label: "Labor", value: "$3,870.00" },
              { label: "Disposal & permits", value: "$420.00" },
            ].map((r) => (
              <div
                key={r.label}
                className="flex justify-between text-[13px] text-ink"
              >
                <span>{r.label}</span>
                <span className="font-mono font-semibold">{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[14px] font-semibold text-ink border-t border-hair pt-3">
              <span>Subtotal</span>
              <span className="font-mono">${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Margin slider */}
            <div className="bg-blue-soft rounded-xl p-4 mt-1">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    Target margin
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    Recommended 32-42%
                  </div>
                </div>
                <div className="text-[28px] font-mono font-bold text-ink leading-none">
                  {marginPct}%
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={55}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                className="w-full mt-3 accent-[#4C85E5] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted mt-1">
                <span>20%</span>
                <span>55%</span>
              </div>
              <div className="text-[12px] text-muted mt-2">
                Adds <span className="font-semibold text-ink">${grossProfit.toLocaleString()}</span> to subtotal
              </div>
            </div>

            {/* Sales tax */}
            <div className="flex justify-between text-[13px] text-ink">
              <span>
                Sales tax · 7.5%{" "}
                <span className="text-muted text-[11px]">labor exempt</span>
              </span>
              <span className="font-mono">$0.00</span>
            </div>

            {/* Grand total */}
            <div className="border-t border-hair pt-4 mt-1">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    Customer total
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    $0 down &middot; 84mo
                  </div>
                </div>
                <div className="text-[36px] font-mono font-bold text-ink leading-none tracking-tight">
                  ${Math.round(customerTotal).toLocaleString()}
                </div>
              </div>
            </div>

            {/* CTA bar */}
            <div className="border-t border-hair pt-4 flex items-center justify-between">
              <span className="text-[11.5px] text-muted">
                All figures lock when you continue.
              </span>
              <button
                onClick={() => navigate("/proposal")}
                className="py-2.5 px-5 bg-ink text-white rounded-xl text-[13px] font-semibold cursor-pointer border-none hover:bg-ink-2 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>

          {/* Financing card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-5">
            <div className="text-[13px] font-semibold text-ink mb-3">
              Financing options to show
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <FinancingOption
                title="$0 down · 84 mo"
                sub="9.99% APR · $336/mo"
                selected={financing[0]}
                onClick={() => toggleFinancing(0)}
              />
              <FinancingOption
                title="$2,500 down · 60 mo"
                sub="7.99% APR · $456/mo"
                selected={financing[1]}
                onClick={() => toggleFinancing(1)}
              />
              <FinancingOption
                title="Same as cash · 18 mo"
                sub="0% promo · $1,421/mo"
                selected={financing[2]}
                onClick={() => toggleFinancing(2)}
              />
              <FinancingOption
                title="Pay in full"
                sub="3% cash discount"
                selected={financing[3]}
                onClick={() => toggleFinancing(3)}
              />
            </div>
          </div>
        </div>
      </main>
    </DarkLayout>
  );
}
