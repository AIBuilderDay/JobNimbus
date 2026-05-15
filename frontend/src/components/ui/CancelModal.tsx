import { useEffect, useRef } from "react";

interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  onSaveDraft: () => void;
  onDeleteDraft: () => void;
  saving?: boolean;
  deleting?: boolean;
}

export default function CancelModal({
  open,
  onClose,
  onSaveDraft,
  onDeleteDraft,
  saving,
  deleting,
}: CancelModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const busy = saving || deleting;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: "rgba(14,24,48,0.7)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.3)] w-full max-w-[420px] mx-4 overflow-hidden"
        style={{ animation: "modal-in 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3 mb-1">
            <span
              className="material-symbols-rounded text-[22px]"
              style={{ color: "#d99344" }}
            >
              warning
            </span>
            <h2 className="text-[18px] font-semibold text-ink m-0">
              Leave this estimate?
            </h2>
          </div>
          <p className="text-[14px] text-muted leading-relaxed mt-2 ml-[34px]">
            You have unsaved changes. What would you like to do with this estimate?
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-6 pt-4 pb-6">
          <button
            onClick={onSaveDraft}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-hair bg-blue-soft text-ink font-medium text-[14px] cursor-pointer transition-colors hover:bg-[#dce6f7] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-rounded text-[20px] text-blue">
              save
            </span>
            <div className="flex flex-col items-start">
              <span>{saving ? "Saving…" : "Save as draft"}</span>
              <span className="text-[11px] text-muted font-normal">
                Continue later from estimate history
              </span>
            </div>
          </button>

          <button
            onClick={onDeleteDraft}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-[14px] font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: "rgba(220,60,60,0.2)",
              background: "rgba(220,60,60,0.05)",
              color: "#dc3c3c",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(220,60,60,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(220,60,60,0.05)";
            }}
          >
            <span className="material-symbols-rounded text-[20px]">
              delete
            </span>
            <div className="flex flex-col items-start">
              <span>{deleting ? "Deleting…" : "Delete draft"}</span>
              <span className="text-[11px] font-normal" style={{ color: "#dc3c3c", opacity: 0.6 }}>
                This cannot be undone
              </span>
            </div>
          </button>

          <button
            onClick={onClose}
            disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl border border-hair bg-transparent text-muted font-medium text-[14px] cursor-pointer transition-colors hover:bg-paper-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            Keep editing
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
