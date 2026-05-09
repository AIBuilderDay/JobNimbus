import { useNavigate } from "react-router-dom";

export interface StepDef {
  n: number;
  label: string;
  path: string;
}

const DEFAULT_STEPS: StepDef[] = [
  { n: 1, label: "Address", path: "/address" },
  { n: 2, label: "Materials", path: "/estimator" },
  { n: 3, label: "Proposal", path: "/proposal" },
  { n: 4, label: "Finalize", path: "/finalization" },
];

interface StepCrumbsProps {
  current: number;
  steps?: StepDef[];
  completed?: boolean;
}

export default function StepCrumbs({ current, steps = DEFAULT_STEPS, completed }: StepCrumbsProps) {
  const nav = useNavigate();

  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s) => {
        const done = completed || s.n < current;
        const active = !completed && s.n === current;

        let style: React.CSSProperties = {};
        if (completed || done) {
          style = completed
            ? { background: "rgba(58,166,118,0.18)", color: "#6fdba6", boxShadow: "inset 0 0 0 1px rgba(58,166,118,0.25)" }
            : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" };
        } else if (active) {
          style = { background: "rgba(76,133,229,0.22)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(76,133,229,0.5)" };
        } else {
          style = { color: "rgba(255,255,255,0.45)" };
        }

        return (
          <button
            key={s.n}
            onClick={() => nav(s.path)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold font-mono whitespace-nowrap cursor-pointer border-none hover:opacity-80 transition-opacity"
            style={style}
          >
            {completed ? "✓" : s.n} {s.label}
          </button>
        );
      })}
    </div>
  );
}
