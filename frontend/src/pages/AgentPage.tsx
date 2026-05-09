import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import BrandMark from "../components/ui/BrandMark";
import GlassNav, { NavIconButton } from "../components/ui/GlassNav";
import { useAgentChat } from "../hooks/useAgentChat";
import type { ChatMessage, ToolCall } from "../types/agent";

/**
 * Agentic chat surface. Three input modes:
 * 1. Plain text — Claude extracts addresses and drives the estimate flow.
 * 2. File attachments — PDF / CSV / Excel / image. Server normalizes each
 *    upload into Anthropic content blocks (see backend/agent/files.py).
 * 3. Quick suggestions — one-click prompts for first-time visitors.
 *
 * Tool calls render as collapsible cards beneath the assistant text, so
 * you can see exactly what `compute_pricing` was called with and what
 * the underlying API returned (or why it failed).
 */

const ACCEPTED_TYPES = ".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/*";

const SUGGESTIONS = [
  "Estimate the roof at 412 W Holloway Ave, Tampa FL",
  "I have a CSV of addresses — help me run estimates for each one",
  "Quote a metal roof, 32% margin, on 1234 Oak Street, Austin TX",
  "What roofing materials are available?",
];

export default function AgentPage() {
  const { messages, sessionId, streaming, error, send, cancel, reset } =
    useAgentChat();

  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [agentReady, setAgentReady] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Probe agent health on mount so we surface a missing API key up front.
  useEffect(() => {
    fetch("/api/agent/health")
      .then((r) => r.json())
      .then((j) => setAgentReady(Boolean(j.anthropic_configured)))
      .catch(() => setAgentReady(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const handleSend = useCallback(() => {
    if (!input.trim() && pendingFiles.length === 0) return;
    void send({ text: input, files: pendingFiles });
    setInput("");
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [input, pendingFiles, send]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length) setPendingFiles((prev) => [...prev, ...list].slice(0, 8));
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files);
    if (list.length) setPendingFiles((prev) => [...prev, ...list].slice(0, 8));
  }, []);

  const removeFile = (idx: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const isEmpty = messages.length === 0;
  const headerStatus = useMemo(() => {
    if (agentReady === false)
      return { label: "Agent disabled — ANTHROPIC_API_KEY missing", color: "amber" };
    if (streaming) return { label: "Thinking…", color: "blue" };
    if (sessionId) return { label: `Session ${sessionId.slice(0, 8)}`, color: "muted" };
    return { label: "Ready", color: "green" };
  }, [agentReady, streaming, sessionId]);

  return (
    <div className="min-h-screen bg-paper-2 text-ink font-sans flex flex-col">
      <div className="pt-4">
        <GlassNav variant="light" minWidth={1180}>
          <Link to="/" className="flex items-center no-underline">
            <BrandMark size={30} />
          </Link>
          <div className="ml-3 text-[12px] font-mono text-muted-2 uppercase tracking-wider">
            Agent
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 mr-2 text-[11px] font-mono">
            <StatusDot color={headerStatus.color} />
            <span className="text-muted">{headerStatus.label}</span>
          </div>
          <NavIconButton
            icon="restart_alt"
            tooltip="New conversation"
            theme="light"
            onClick={() => void reset()}
          />
          <NavIconButton
            icon="dashboard"
            tooltip="Estimate history"
            theme="light"
            onClick={() => (window.location.href = "/estimates")}
          />
        </GlassNav>
      </div>

      <main className="flex-1 max-w-[920px] w-full mx-auto px-6 py-8 flex flex-col gap-4 min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-2xl bg-white border border-hair shadow-[0_1px_2px_rgba(21,41,82,0.04)] p-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {isEmpty ? (
            <EmptyState onPick={(s) => setInput(s)} />
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {streaming && messages[messages.length - 1]?.role === "assistant" && (
                <div className="flex items-center gap-2 pl-12 text-[12px] text-muted-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue animate-bounce [animation-delay:240ms]" />
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-2.5 text-[13px] text-ink">
            {error}
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-soft border border-blue/15 text-[12px] text-ink"
              >
                <FileGlyph name={f.name} type={f.type} />
                <span className="font-mono">{f.name}</span>
                <button
                  className="text-muted-2 hover:text-ink cursor-pointer bg-transparent border-none"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-white border border-hair p-3 flex items-end gap-2 shadow-[0_2px_4px_rgba(21,41,82,0.04)]">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            title="Attach PDF, CSV, Excel, or image"
            className="w-10 h-10 rounded-xl bg-paper-2 border border-hair text-muted hover:text-ink hover:bg-blue-soft cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-[18px] transition-colors shrink-0"
          >
            <span className="material-symbols-rounded">attach_file</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            onChange={onPickFiles}
            className="hidden"
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Claude to estimate a roof, parse a PDF of an inspection, or refine pricing…"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] text-ink placeholder:text-muted-2 font-sans leading-[1.5] py-2 max-h-40"
          />

          {streaming ? (
            <button
              onClick={cancel}
              className="px-4 h-10 rounded-xl bg-amber/15 text-amber border border-amber/40 hover:bg-amber/20 cursor-pointer text-[13px] font-semibold flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-rounded text-[16px]">stop</span>
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={(!input.trim() && pendingFiles.length === 0) || agentReady === false}
              className="px-4 h-10 rounded-xl bg-ink text-white hover:bg-ink-2 cursor-pointer text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 transition-colors"
            >
              Send
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="text-[11px] font-mono text-muted-2 text-center px-2">
          Drag files anywhere on the chat to attach. PDF, CSV, Excel, or image.
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Empty state                                                          */
/* -------------------------------------------------------------------- */

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[linear-gradient(135deg,#4C85E5,#3868C6)] text-white text-[22px] font-bold mb-4 shadow-lg">
        ✦
      </div>
      <h2 className="font-serif text-[28px] leading-tight text-ink mb-2">
        Estimate a roof, conversationally.
      </h2>
      <p className="text-[14px] text-muted max-w-[480px] mb-7">
        Drop in an address, paste a list, or upload a PDF inspection report.
        Claude will measure the roof, price it, and refine the quote with you.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[640px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left px-4 py-3 rounded-xl bg-paper-2 border border-hair hover:bg-blue-soft hover:border-blue/30 cursor-pointer transition-colors text-[13px] text-ink/80 font-sans leading-snug"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Message bubbles                                                      */
/* -------------------------------------------------------------------- */

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] flex flex-col items-end gap-1.5">
          {msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {msg.attachments.map((a, i) => (
                <span
                  key={`${a.name}-${i}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue/10 border border-blue/15 text-[11px] text-ink/80 font-mono"
                >
                  <FileGlyph name={a.name} kind={a.kind} />
                  {a.name}
                  <span className="text-muted-2">·</span>
                  <span className="text-muted-2">{a.summary}</span>
                </span>
              ))}
            </div>
          )}
          {msg.text && (
            <div className="rounded-2xl rounded-br-md bg-ink text-white px-4 py-2.5 text-[13.5px] leading-[1.5] whitespace-pre-wrap">
              {msg.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === "system-error") {
    return (
      <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-[13px] text-ink">
        <span className="font-semibold text-amber">Agent error · </span>
        {msg.text}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[15px] font-bold shrink-0"
        style={{ background: "linear-gradient(135deg, #4C85E5, #3868C6)" }}
      >
        ✦
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.segments.map((seg, idx) => {
          if (seg.kind === "text") {
            return (
              <div
                key={idx}
                className="prose-roofing text-[13.5px] leading-[1.6] text-ink whitespace-pre-wrap"
              >
                {renderMarkdownLite(seg.text)}
              </div>
            );
          }
          const tc = msg.toolCalls[seg.toolId];
          if (!tc) return null;
          return <ToolCallCard key={idx} tc={tc} />;
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Tool call cards                                                      */
/* -------------------------------------------------------------------- */

function ToolCallCard({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false);
  const headline = useMemo(() => formatToolHeadline(tc), [tc]);

  return (
    <div
      className={`rounded-xl border text-[12px] font-mono ${
        tc.isError
          ? "border-amber/40 bg-amber/5"
          : tc.status === "done"
          ? "border-green/30 bg-green/5"
          : "border-blue/25 bg-blue-soft"
      }`}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none cursor-pointer text-left"
      >
        <ToolStatusIcon status={tc.status} isError={tc.isError} />
        <span className="font-semibold text-ink">{tc.name}</span>
        <span className="text-muted-2 truncate flex-1">{headline}</span>
        {tc.durationMs !== null && (
          <span className="text-muted-2 shrink-0">{tc.durationMs}ms</span>
        )}
        <span className="text-muted-2 shrink-0">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {tc.input && (
            <details open className="text-[11px]">
              <summary className="cursor-pointer text-muted hover:text-ink">
                input
              </summary>
              <pre className="mt-1 bg-white/70 border border-hair rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all text-[10.5px] leading-snug">
                {JSON.stringify(tc.input, null, 2)}
              </pre>
            </details>
          )}
          {tc.result !== undefined && (
            <details open={tc.isError} className="text-[11px]">
              <summary className="cursor-pointer text-muted hover:text-ink">
                {tc.isError ? "error" : "result"}
              </summary>
              <pre
                className={`mt-1 border rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all text-[10.5px] leading-snug max-h-72 ${
                  tc.isError ? "bg-amber/10 border-amber/30 text-ink" : "bg-white/70 border-hair"
                }`}
              >
                {prettyJson(tc.result)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ToolStatusIcon({
  status,
  isError,
}: {
  status: ToolCall["status"];
  isError: boolean;
}) {
  if (isError || status === "error") {
    return <span className="text-amber text-[14px]">⚠</span>;
  }
  if (status === "done") {
    return <span className="text-green text-[14px]">✓</span>;
  }
  return (
    <span className="w-3 h-3 rounded-full border-[1.5px] border-blue border-t-transparent animate-spin" />
  );
}

function formatToolHeadline(tc: ToolCall): string {
  if (tc.isError && typeof tc.result === "string") return tc.result;
  if (tc.input && Object.keys(tc.input).length) {
    const first = Object.entries(tc.input)[0];
    return `${first[0]}=${stringify(first[1])}`;
  }
  return tc.status === "done" ? "ok" : tc.status;
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function prettyJson(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/* -------------------------------------------------------------------- */
/*  Tiny utilities                                                       */
/* -------------------------------------------------------------------- */

function StatusDot({ color }: { color: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue",
    green: "bg-green",
    amber: "bg-amber",
    muted: "bg-muted-2",
  };
  return <span className={`w-2 h-2 rounded-full ${map[color] ?? "bg-muted-2"}`} />;
}

function FileGlyph({
  name,
  type,
  kind,
}: {
  name: string;
  type?: string;
  kind?: string;
}) {
  const lower = (kind ?? name).toLowerCase();
  let label = "FILE";
  if (lower.endsWith(".pdf") || lower === "pdf") label = "PDF";
  else if (lower.endsWith(".csv") || lower === "csv") label = "CSV";
  else if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower === "xlsx")
    label = "XLS";
  else if (lower === "image" || (type ?? "").startsWith("image/")) label = "IMG";
  return (
    <span className="text-[9px] font-bold tracking-widest text-blue/70">
      {label}
    </span>
  );
}

/**
 * Tiny markdown-like renderer — bold (**...**), inline code (`...`), and
 * preserves newlines. We don't pull in a full markdown lib for one chat page.
 */
function renderMarkdownLite(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  tokens.forEach((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      out.push(
        <strong key={i} className="font-semibold text-ink">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      out.push(
        <code
          key={i}
          className="font-mono text-[12px] px-1 py-0.5 rounded bg-paper-2 border border-hair"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      out.push(<span key={i}>{tok}</span>);
    }
  });
  return out;
}
