import { useRef, useState } from "react";
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
import { sendProposal } from "../api/proposal";
import { renderElementToPdfBase64 } from "../lib/pdfFromElement";


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
/*  Tone chip                                                          */
/* ------------------------------------------------------------------ */

function ToneChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold cursor-pointer border transition-colors"
      style={{
        background: selected ? "rgba(76,133,229,0.1)" : "#fff",
        borderColor: selected ? "#4C85E5" : "#e6ecf6",
        color: selected ? "#4C85E5" : "#6b7a96",
      }}
    >
      {label}
    </button>
  );
}

/* ================================================================== */
/*  ProposalPage                                                       */
/* ================================================================== */

function monthlyPayment(total: number, down: number, aprPct: number, months: number): string {
  const principal = total - down;
  if (aprPct === 0) return Math.round(principal / months).toLocaleString();
  const r = aprPct / 100 / 12;
  const pmt = principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(pmt).toLocaleString();
}

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function ProposalPage() {
  const navigate = useNavigate();
  const { address, estimateId, proposalState, pricingState, setProposalState, setLastProposalPdfBase64 } = useEstimatorStore();
  const { isSyncing, lastSyncedAt, syncNow } = useAutoSync();
  const { data: pricing } = usePricing(estimateId);
  const totalDisplay = pricing ? fmtUSD(pricing.customer_total_cents) : "$25,582";
  const customerTotal = pricing ? pricing.customer_total_cents / 100 : 25582;
  const { financing } = pricingState;
  const displayName = proposalState.customerName || "Homeowner";
  const displayAddress = address ?? "No address selected";
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const { coverNote, recipient, cc, tone, toggles } = proposalState;
  const setCoverNote = (v: string) => setProposalState({ coverNote: v });
  const setRecipient = (v: string) => setProposalState({ recipient: v });
  const setCc = (v: string) => setProposalState({ cc: v });
  const setTone = (v: number) => setProposalState({ tone: v });

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const toneLabels = ["Formal", "Conversational", "Direct", "Warm"];
  const toggleLabels = [
    "Show financing",
    "Embed e-signature",
    "Attach drone photos",
    "Include warranty PDF",
  ];

  const toggleAt = (i: number) =>
    setProposalState({ toggles: toggles.map((v, j) => (j === i ? !v : v)) });

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      if (!previewRef.current) throw new Error("Preview not ready");
      const pdfBase64 = await renderElementToPdfBase64(previewRef.current);
      setLastProposalPdfBase64(pdfBase64);
      await sendProposal({
        recipient,
        cc,
        coverNote,
        address: address ?? "",
        total: totalDisplay,
        tone: toneLabels[tone],
        includeFinancing: toggles[0],
        includeEsignature: toggles[1],
        includeDronePhotos: toggles[2],
        includeWarrantyPdf: toggles[3],
        pdfBase64,
      });
      syncNow();
      navigate("/finalization");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send proposal");
    } finally {
      setSending(false);
    }
  };

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
        <StepCrumbs current={4} />
        <NavDivider />
        <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />
        <NavDivider />
        <NavIconButton icon="send" tooltip="Send to homeowner" variant="primary" onClick={handleSend} disabled={sending} />
      </GlassNav>

      {/* Body */}
      <main
        className="relative z-[2] max-w-[1280px] mx-auto px-6 pt-14 pb-20 grid gap-6"
        style={{ gridTemplateColumns: "380px 1fr" }}
      >
        {/* ---- LEFT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Eyebrow + title */}
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              PROPOSAL &middot; STEP 4 OF 5
            </div>
            <h1 className="font-serif text-[44px] leading-[1.06] font-normal tracking-[-1px] text-white mt-1.5">
              Compose &amp; send.
            </h1>
          </div>

          {/* Compose card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-5 flex flex-col gap-5">
            {/* Cover note */}
            <div>
              <label className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2 block">
                COVER NOTE
              </label>
              <textarea
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-hair bg-paper-2 p-3.5 text-[13px] text-ink leading-relaxed resize-y focus:outline-none focus:border-blue-bright font-sans"
              />
              <div className="text-[10.5px] text-muted mt-1 font-mono">
                AI-drafted &middot; editable
              </div>
            </div>

            {/* Recipient + CC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5 block">
                  RECIPIENT
                </label>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full rounded-lg border border-hair bg-paper-2 py-2 px-3 text-[12.5px] text-ink font-mono focus:outline-none focus:border-blue-bright"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5 block">
                  CC
                </label>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="w-full rounded-lg border border-hair bg-paper-2 py-2 px-3 text-[12.5px] text-ink font-mono focus:outline-none focus:border-blue-bright"
                />
              </div>
            </div>

            {/* Tone chips */}
            <div>
              <label className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2 block">
                TONE
              </label>
              <div className="flex gap-2 flex-wrap">
                {toneLabels.map((t, i) => (
                  <ToneChip
                    key={t}
                    label={t}
                    selected={tone === i}
                    onClick={() => setTone(i)}
                  />
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3">
              {toggleLabels.map((label, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">{label}</span>
                  <Toggle on={toggles[i]} onChange={() => toggleAt(i)} />
                </div>
              ))}
            </div>

            {/* Ready to send */}
            <div className="rounded-xl border-2 border-blue-bright p-4 flex flex-col gap-3">
              <div className="text-[13px] font-semibold text-ink">
                Ready to send
              </div>
              <div className="text-[12px] text-muted leading-relaxed">
                {displayName} will receive a branded email with an interactive proposal
                link. The proposal locks pricing for 30 days.
              </div>
              {sendError && (
                <div className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {sendError}
                </div>
              )}
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full py-3 bg-blue text-white rounded-xl text-[14px] font-semibold cursor-pointer border-none hover:bg-blue-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "Sending…" : `Send proposal · ${totalDisplay}`}
              </button>
            </div>
          </div>
        </div>

        {/* ---- RIGHT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Eyebrow + title */}
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              LIVE PREVIEW
            </div>
            <h1 className="font-serif text-[44px] leading-[1.06] font-normal tracking-[-1px] text-white mt-1.5">
              What {displayName} will see.
            </h1>
          </div>


          {/* PDF preview card */}
          <div
            ref={previewRef}
            className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.15)] p-8 overflow-hidden"
            style={{ aspectRatio: "8.5 / 11" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <BrandMark size={28} />
                <div>
                  <div className="text-[12px] font-semibold text-ink">
                    Nimbus Quote
                  </div>
                  <div className="text-[10px] text-muted font-mono">
                    Lehi, UT &middot; License #CCC1331234
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-muted">
                  {estimateId ? `EST-${estimateId.slice(0, 6).toUpperCase()}` : "EST-DRAFT"}
                </div>
                <div className="text-[10px] font-mono text-muted">
                  Generated {today}
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="font-serif text-[28px] leading-[1.1] font-normal text-ink tracking-[-0.5px] mb-1">
              Re-roof proposal for {displayName}.
            </h2>
            <div className="text-[11px] text-muted font-mono mb-6">
              {displayAddress}
            </div>

            {/* Cover note */}
            <div className="text-[11px] text-ink/80 leading-relaxed whitespace-pre-line mb-6 max-h-[180px] overflow-hidden">
              {coverNote}
            </div>

            {/* Summary table */}
            <div className="border border-hair rounded-lg overflow-hidden mb-6">
              <div className="grid grid-cols-2 bg-paper-2 px-3 py-1.5 text-[9px] font-mono text-muted uppercase tracking-wider border-b border-hair">
                <span>DESCRIPTION</span>
                <span className="text-right">AMOUNT</span>
              </div>
              {(pricing
                ? [
                    { label: "Subtotal", value: fmtUSD(pricing.subtotal_cents) },
                    { label: `Sales tax (${pricing.sales_tax_pct}%)`, value: fmtUSD(pricing.sales_tax_cents) },
                  ]
                : [
                    { label: "Materials", value: "$14,248.10" },
                    { label: "Labor", value: "$3,870.00" },
                    { label: "Disposal & permits", value: "$420.00" },
                  ]
              ).map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-2 px-3 py-1.5 text-[10.5px] border-b border-hair/60 last:border-b-0"
                >
                  <span className="text-ink">{r.label}</span>
                  <span className="text-right font-mono text-ink">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Grand total */}
            <div className="bg-blue-soft rounded-lg p-3 flex justify-between items-center mb-6">
              <span className="text-[12px] font-semibold text-ink">
                Total due
              </span>
              <span className="text-[20px] font-mono font-bold text-ink">
                {totalDisplay}
              </span>
            </div>

            {/* Financing */}
            {toggles[0] && <div className="border border-hair rounded-lg p-3 mb-6">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
                FINANCING
              </div>
              {financing === 0 && (
                <>
                  <div className="flex justify-between text-[10.5px] text-ink">
                    <span>$0 down · 84 months @ 9.99% APR</span>
                    <span className="font-mono font-semibold">${monthlyPayment(customerTotal, 0, 9.99, 84)}/mo</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-muted mt-1">
                    <span>Total financed cost</span>
                    <span className="font-mono">${(Number(monthlyPayment(customerTotal, 0, 9.99, 84).replace(/,/g, "")) * 84).toLocaleString()}</span>
                  </div>
                </>
              )}
              {financing === 1 && (
                <>
                  <div className="flex justify-between text-[10.5px] text-ink">
                    <span>$2,500 down · 60 months @ 7.99% APR</span>
                    <span className="font-mono font-semibold">${monthlyPayment(customerTotal, 2500, 7.99, 60)}/mo</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-muted mt-1">
                    <span>Total financed cost</span>
                    <span className="font-mono">${(2500 + Number(monthlyPayment(customerTotal, 2500, 7.99, 60).replace(/,/g, "")) * 60).toLocaleString()}</span>
                  </div>
                </>
              )}
              {financing === 2 && (
                <>
                  <div className="flex justify-between text-[10.5px] text-ink">
                    <span>Same as cash · 18 months @ 0% APR</span>
                    <span className="font-mono font-semibold">${monthlyPayment(customerTotal, 0, 0, 18)}/mo</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-muted mt-1">
                    <span>Total cost (same as cash)</span>
                    <span className="font-mono">${Math.round(customerTotal).toLocaleString()}</span>
                  </div>
                </>
              )}
              {financing === 3 && (
                <>
                  <div className="flex justify-between text-[10.5px] text-ink">
                    <span>Pay in full · 3% discount</span>
                    <span className="font-mono font-semibold">−${Math.round(customerTotal * 0.03).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-muted mt-1">
                    <span>Amount due</span>
                    <span className="font-mono">${Math.round(customerTotal * 0.97).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>}

            {/* Signature blocks */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="border-b border-ink/20 pb-6 mb-1.5" />
                <div className="text-[9.5px] text-muted font-mono">
                  Homeowner signature
                </div>
              </div>
              <div>
                <div className="border-b border-ink/20 pb-6 mb-1.5" />
                <div className="text-[9.5px] text-muted font-mono">
                  Contractor signature
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-hair pt-3 text-[9px] text-muted font-mono text-center">
              Nimbus Quote &middot; Lehi, UT
              &middot; (813) 555-0142
            </div>
          </div>
        </div>
      </main>
    </DarkLayout>
  );
}
