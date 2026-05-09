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

export default function ProposalPage() {
  const navigate = useNavigate();
  const { address, proposalState, setProposalState } = useEstimatorStore();
  const { isSyncing, lastSyncedAt, syncNow } = useAutoSync();

  const { coverNote, recipient, cc, tone, toggles, previewTab } = proposalState;
  const setCoverNote = (v: string) => setProposalState({ coverNote: v });
  const setRecipient = (v: string) => setProposalState({ recipient: v });
  const setCc = (v: string) => setProposalState({ cc: v });
  const setTone = (v: number) => setProposalState({ tone: v });
  const setPreviewTab = (v: number) => setProposalState({ previewTab: v });

  const toneLabels = ["Formal", "Conversational", "Direct", "Warm"];
  const previewTabs = [
    "Page 1 · Cover",
    "Page 2 · Scope",
    "Page 3 · Pricing",
    "Mobile",
  ];
  const toggleLabels = [
    "Show financing",
    "Embed e-signature",
    "Attach drone photos",
    "Include warranty PDF",
  ];

  const toggleAt = (i: number) =>
    setProposalState({ toggles: toggles.map((v, j) => (j === i ? !v : v)) });

  const handleSend = () => {
    syncNow();
    navigate("/finalization");
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
        <StepCrumbs current={3} />
        <NavDivider />
        <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />
        <NavDivider />
        <NavIconButton icon="send" tooltip="Send to homeowner" variant="primary" onClick={handleSend} />
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
              PROPOSAL &middot; STEP 5 OF 5
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
                Maria will receive a branded email with an interactive proposal
                link. The proposal locks pricing for 30 days.
              </div>
              <button
                onClick={handleSend}
                className="w-full py-3 bg-blue text-white rounded-xl text-[14px] font-semibold cursor-pointer border-none hover:bg-blue-bright transition-colors"
              >
                Send proposal &middot; $25,582
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
              What Maria will see.
            </h1>
          </div>

          {/* Preview tabs */}
          <div className="flex gap-1">
            {previewTabs.map((t, i) => (
              <button
                key={t}
                onClick={() => setPreviewTab(i)}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold font-mono cursor-pointer border-none transition-colors"
                style={{
                  background:
                    i === previewTab
                      ? "rgba(255,255,255,0.15)"
                      : "transparent",
                  color:
                    i === previewTab
                      ? "#fff"
                      : "rgba(255,255,255,0.5)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* PDF preview card */}
          <div
            className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.15)] p-8 overflow-hidden"
            style={{ aspectRatio: "8.5 / 11" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <BrandMark size={28} />
                <div>
                  <div className="text-[12px] font-semibold text-ink">
                    Holloway Roofing Co.
                  </div>
                  <div className="text-[10px] text-muted font-mono">
                    Tampa, FL &middot; License #CCC1331234
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-muted">
                  EST-2418 &middot; v3
                </div>
                <div className="text-[10px] font-mono text-muted">
                  Generated Mar 14, 2025
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="font-serif text-[28px] leading-[1.1] font-normal text-ink tracking-[-0.5px] mb-1">
              Re-roof proposal for the Delgado residence.
            </h2>
            <div className="text-[11px] text-muted font-mono mb-6">
              412 W Holloway Ave &middot; Tampa, FL 33606
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
              {[
                { label: "Materials", value: "$14,248.10" },
                { label: "Labor", value: "$3,870.00" },
                { label: "Disposal & permits", value: "$420.00" },
                { label: "Margin (38%)", value: "$7,044.00" },
              ].map((r) => (
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
                $25,582
              </span>
            </div>

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
              Holloway Roofing Co. &middot; 1200 N Tampa St, Tampa FL 33602
              &middot; (813) 555-0142
            </div>
          </div>
        </div>
      </main>
    </DarkLayout>
  );
}
