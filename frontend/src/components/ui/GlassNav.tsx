import type { ReactNode } from "react";

interface GlassNavProps {
  children: ReactNode;
  variant?: "dark" | "light";
  minWidth?: number;
}

export default function GlassNav({ children, variant = "dark", minWidth = 1240 }: GlassNavProps) {
  const base = variant === "dark"
    ? "bg-white/10 shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)]"
    : "bg-white/88 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_8px_26px_rgba(21,41,82,0.10),0_0_0_1px_rgba(21,41,82,0.06)]";

  return (
    <div className="sticky top-4 z-50 flex justify-center px-6 pointer-events-none">
      <nav
        className={`pointer-events-auto flex flex-row items-center justify-between gap-4.5 py-3 pl-5 pr-3.5 backdrop-blur-2xl rounded-[18px] ${base}`}
        style={{ minWidth }}
      >
        {children}
      </nav>
    </div>
  );
}

export function NavDivider() {
  return <div className="w-px h-6.5 bg-white/12" />;
}

export function NavMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-px px-1">
      <span className="text-[9.5px] font-mono text-white/45 tracking-wider uppercase">{label}</span>
      <span className="text-xs font-semibold text-white font-mono">{value}</span>
    </div>
  );
}

export function SavedIndicator({ text = "Synced just now" }: { text?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/70 font-mono px-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#5fd39a] shadow-[0_0_0_3px_rgba(95,211,154,0.2)]" />
      {text}
    </div>
  );
}

export function NavGhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="py-2.5 px-3 bg-transparent text-white/85 border border-white/15 rounded-[10px] text-[12.5px] font-semibold cursor-pointer font-sans">
      {children}
    </button>
  );
}

export function NavPrimaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="py-2.5 px-3.5 bg-white text-ink border-none rounded-[10px] text-[12.5px] font-semibold cursor-pointer font-sans tracking-tight">
      {children}
    </button>
  );
}
