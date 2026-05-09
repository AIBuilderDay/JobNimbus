import type { EstimateStatus } from "../../types/estimate";

const pillStyles: Record<EstimateStatus, { bg: string; text: string; dot: string }> = {
  signed: { bg: "bg-green/14", text: "text-[#1f7d51]", dot: "bg-green" },
  sent: { bg: "bg-blue/14", text: "text-blue", dot: "bg-blue" },
  draft: { bg: "bg-amber/14", text: "text-[#a86b1f]", dot: "bg-amber" },
  expired: { bg: "bg-muted/14", text: "text-muted", dot: "bg-muted-2" },
};

export default function StatusPill({ status }: { status: EstimateStatus }) {
  const s = pillStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10.5px] font-bold font-mono tracking-wide w-fit ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.toUpperCase()}
    </span>
  );
}
