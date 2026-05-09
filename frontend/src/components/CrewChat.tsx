import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How do I change the roof material?",
  "What materials are available?",
  "How do I adjust pricing?",
  "How do I send a proposal?",
];

// Swap this out for a real backend call once MCP endpoints are wired.
// Expected future shape: POST /api/chat { messages } → { content: string }
async function fetchAssistantReply(history: Message[]): Promise<string> {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

  const last = history[history.length - 1]?.content.toLowerCase() ?? "";

  if (
    last.includes("material") ||
    last.includes("shingle") ||
    last.includes("metal") ||
    last.includes("membrane")
  ) {
    return "To change the roof material:\n\n1. Open the **Materials** panel (bottom-right of the estimator)\n2. Pick a category — Shingle, Metal, or Membrane\n3. Click a swatch to apply it to the selected roof faces\n\nSelect faces first using the checklist in the **Faces** panel on the right.";
  }

  if (
    last.includes("price") ||
    last.includes("cost") ||
    last.includes("margin")
  ) {
    return "To adjust pricing:\n\n1. Go to **Step 4 · Pricing** in the nav bar\n2. Review the auto-generated line items\n3. Drag the margin slider (recommended 32–42%)\n4. Toggle warranty and certification options\n\nAll figures lock when you continue to the proposal.";
  }

  if (
    last.includes("proposal") ||
    last.includes("send") ||
    last.includes("email")
  ) {
    return "To send a proposal:\n\n1. Go to **Step 5 · Proposal**\n2. Edit the AI-drafted cover note\n3. Set the recipient and CC emails\n4. Pick a tone and toggle attachment options\n5. Preview the PDF on the right\n6. Click **Send proposal**\n\nPricing locks for 30 days once sent.";
  }

  if (
    last.includes("face") ||
    last.includes("select") ||
    last.includes("roof plane")
  ) {
    return "To manage roof faces:\n\n1. Use the **Faces** panel on the right\n2. Toggle checkboxes to select or deselect planes\n3. Hover a face in the list to highlight it on the 3D model\n4. Selected faces show their combined area\n\nDrag the model or use the rotation buttons to view all angles.";
  }

  if (last.includes("help") || last.includes("what can")) {
    return "I can help with:\n\n- **Materials** — change shingles, metal, or membrane\n- **Roof faces** — select and inspect planes\n- **Pricing** — margins, line items, financing\n- **Proposals** — compose, preview, and send\n- **Navigation** — move between steps\n\nWhat would you like to do?";
  }

  return "I'm Bob, your estimating assistant. I can help with materials, roof faces, pricing, and proposals.\n\nTry asking:\n- How do I change the roof material?\n- How do I adjust pricing?\n- How do I send a proposal?";
}

function renderContent(text: string, isUser: boolean) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={i}
          className={`font-semibold ${isUser ? "text-white" : "text-ink"}`}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function CrewChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };

      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput("");
      setLoading(true);

      const reply = await fetchAssistantReply(updated);

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
      setLoading(false);
    },
    [messages, loading],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute z-40 flex items-center gap-2 py-2.5 px-4 rounded-xl border-none cursor-pointer text-white text-[12.5px] font-semibold font-sans shadow-[0_4px_20px_rgba(56,104,198,0.35)] hover:brightness-110 transition-all"
        style={{
          right: 20,
          bottom: 24,
          background: "linear-gradient(135deg, #4C85E5 0%, #3868C6 100%)",
        }}
      >
        <span className="material-symbols-rounded text-[16px]">star</span>
        Ask Bob
        <kbd className="font-mono text-[10px] text-white/70 bg-white/15 py-0.5 px-1.5 rounded ml-1">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="absolute z-50 flex flex-col rounded-2xl overflow-hidden bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)]"
      style={{
        right: 20,
        bottom: 24,
        width: 380,
        height: 520,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hair shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[12px] font-bold"
            style={{
              background: "linear-gradient(135deg, #4C85E5, #3868C6)",
            }}
          >
            B
          </div>
          <div>
            <div className="text-[13px] font-semibold text-ink leading-tight">
              Bob
            </div>
            <div className="text-[10px] font-mono text-muted">
              AI assistant
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-lg bg-paper-2 border-none text-muted hover:text-ink hover:bg-hair cursor-pointer flex items-center justify-center text-[16px] transition-colors"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-paper-2/50"
      >
        {messages.length === 0 && (
          <div className="text-center pt-4">
            <div
              className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center text-white text-[18px] font-bold"
              style={{
                background: "linear-gradient(135deg, #4C85E5, #3868C6)",
              }}
            >
              B
            </div>
            <div className="text-[14px] font-semibold text-ink mb-1">
              How can I help?
            </div>
            <div className="text-[12px] text-muted mb-5">
              Ask about materials, pricing, proposals, or navigation.
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-3 py-2 rounded-lg bg-white border border-hair text-[12px] text-muted hover:bg-blue-soft hover:text-ink cursor-pointer transition-colors font-sans"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue text-white rounded-br-sm"
                  : "bg-white text-ink/80 rounded-bl-sm border border-hair shadow-sm"
              }`}
            >
              {renderContent(msg.content, msg.role === "user")}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 border border-hair shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-hair shrink-0">
        <div className="flex items-center gap-2 bg-paper-2 rounded-xl px-3 py-2 border border-hair">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Bob anything..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted-2 font-sans"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-7 h-7 rounded-lg border-none cursor-pointer flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-default"
            style={{
              background: "linear-gradient(135deg, #4C85E5, #3868C6)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 7h10M8 3l4 4-4 4"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
