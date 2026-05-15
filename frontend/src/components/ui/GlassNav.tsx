import type { ReactNode } from "react";

interface GlassNavProps {
  children: ReactNode;
  variant?: "dark" | "light";
  minWidth?: number;
  wrapperClassName?: string;
}

export default function GlassNav({ children, variant = "dark", minWidth, wrapperClassName }: GlassNavProps) {
  const base = variant === "dark"
    ? "bg-white/10 shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_26px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.10)]"
    : "bg-white/88 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_8px_26px_rgba(21,41,82,0.10),0_0_0_1px_rgba(21,41,82,0.06)]";

  return (
    <div className={wrapperClassName ?? "sticky top-4 z-50 flex justify-center px-6 pointer-events-none"}>
      <nav
        className={`pointer-events-auto flex flex-row items-center justify-between gap-4.5 py-3 pl-5 pr-3.5 backdrop-blur-2xl rounded-[18px] max-w-full ${base}`}
        style={{ minWidth: minWidth ? `min(${minWidth}px, calc(100vw - 48px))` : undefined }}
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

export function SavedIndicator({ isSyncing = false, lastSyncedAt }: { isSyncing?: boolean; lastSyncedAt?: number | null }) {
  const label = isSyncing
    ? "Syncing…"
    : lastSyncedAt
      ? `Saved ${formatTimeAgo(lastSyncedAt)}`
      : "Not saved";

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/70 font-mono px-1">
      <span
        className={`material-symbols-rounded text-[16px] ${isSyncing ? "animate-spin" : ""}`}
      >
        {isSyncing ? "sync" : "check_circle"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  return `${mins}m ago`;
}

interface NavIconButtonProps {
  icon: string;
  tooltip: string;
  onClick?: () => void;
  variant?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  theme?: "dark" | "light";
}

export function NavIconButton({ icon, tooltip, onClick, variant = "ghost", disabled, theme = "dark" }: NavIconButtonProps) {
  const base = "group relative w-9 h-9 flex items-center justify-center rounded-[10px] transition-colors";

  const darkStyles = {
    ghost: "bg-transparent text-white/85 border border-white/15 hover:bg-white/8",
    primary: "bg-white text-ink border-none hover:bg-white/90",
    danger: "",
  };

  const lightStyles = {
    ghost: "bg-transparent text-ink/70 border border-ink/12 hover:bg-ink/[0.04]",
    primary: "bg-ink text-white border-none hover:bg-ink/90",
    danger: "",
  };

  const styles = theme === "dark" ? darkStyles : lightStyles;

  if (variant === "danger") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} border ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        style={{ background: "rgba(220,60,60,0.15)", color: "#dc3c3c", borderColor: "rgba(220,60,60,0.3)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,60,60,0.25)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(220,60,60,0.15)"; }}
      >
        <span className="material-symbols-rounded text-[20px]">{icon}</span>
        <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-ink text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {tooltip}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className="material-symbols-rounded text-[20px]">{icon}</span>
      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-ink text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {tooltip}
      </span>
    </button>
  );
}
