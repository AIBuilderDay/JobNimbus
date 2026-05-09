import type { ReactNode } from "react";

export default function DarkLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen font-sans text-ink bg-[linear-gradient(160deg,#1a2440_0%,#0e1830_100%)] relative">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(76,133,229,0.16),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(56,104,198,0.14),transparent_55%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.085)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.085)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_95%)]" />
      {children}
    </div>
  );
}
