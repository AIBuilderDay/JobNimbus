import { useCallback, useRef, useState } from "react";
import {
  AgentEventSchema,
  type AgentEvent,
  type AssistantSegment,
  type ChatMessage,
  type ToolCall,
} from "../types/agent";

/**
 * Drives the agent SSE stream and turns it into renderable chat state.
 *
 * EventSource only supports GET requests with no body, so we use `fetch`
 * with a multipart body and parse SSE frames off the response stream by
 * hand. Each parsed event is validated with the Zod schema before it
 * touches state — anything malformed is logged and dropped, never
 * rendered.
 */

const decoder = new TextDecoder();

function newId() {
  return crypto.randomUUID();
}

interface SendArgs {
  text: string;
  files: File[];
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ text, files }: SendArgs) => {
      if (streaming) return;
      if (!text.trim() && files.length === 0) return;

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        text,
        attachments: files.map((f) => ({
          name: f.name,
          kind: kindForFile(f),
          summary: prettyBytes(f.size),
        })),
      };
      const assistantId = newId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        segments: [],
        toolCalls: {},
        streaming: true,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const form = new FormData();
      form.append("message", text);
      if (sessionId) form.append("session_id", sessionId);
      for (const f of files) form.append("files", f);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            if (j?.detail) detail = String(j.detail);
          } catch {
            // ignore
          }
          throw new Error(detail);
        }

        const reader = res.body.getReader();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";
          for (const frame of frames) {
            const event = parseSSE(frame);
            if (!event) continue;
            handleEvent(event, assistantId, setMessages, setSessionId);
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          // user canceled — silent
        } else {
          const msg = e instanceof Error ? e.message : "An error occurred.";
          console.error("agent chat failed:", e);
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    id: assistantId,
                    role: "system-error",
                    text: msg,
                  }
                : m,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.role === "assistant" && m.id === assistantId
              ? { ...m, streaming: false }
              : m,
          ),
        );
      }
    },
    [sessionId, streaming],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(async () => {
    cancel();
    if (sessionId) {
      // Best-effort — server-side wipe so memory doesn't leak between demos.
      fetch(`/api/agent/sessions/${sessionId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    }
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, [sessionId, cancel]);

  return { messages, sessionId, streaming, error, send, cancel, reset };
}

function parseSSE(frame: string): AgentEvent | null {
  // Frames look like:
  //   event: <type>
  //   data: <json>
  let dataLine = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("data: ")) dataLine = line.slice(6);
  }
  if (!dataLine) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(dataLine);
  } catch (err) {
    console.warn("agent SSE: bad JSON frame", dataLine, err);
    return null;
  }
  const parsed = AgentEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("agent SSE: schema mismatch", raw, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

function handleEvent(
  ev: AgentEvent,
  assistantId: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>,
) {
  if (ev.type === "session") {
    setSessionId(ev.session_id);
    return;
  }

  if (ev.type === "error") {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { id: assistantId, role: "system-error", text: ev.message }
          : m,
      ),
    );
    return;
  }

  if (ev.type === "done") {
    return; // streaming flag is flipped in finally{}
  }

  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId || m.role !== "assistant") return m;
      return applyEventToAssistant(m, ev);
    }),
  );
}

function applyEventToAssistant(
  m: Extract<ChatMessage, { role: "assistant" }>,
  ev: AgentEvent,
): Extract<ChatMessage, { role: "assistant" }> {
  switch (ev.type) {
    case "text_delta": {
      const last = m.segments[m.segments.length - 1];
      if (last && last.kind === "text") {
        const updated: AssistantSegment = {
          kind: "text",
          text: last.text + ev.text,
        };
        return { ...m, segments: [...m.segments.slice(0, -1), updated] };
      }
      return {
        ...m,
        segments: [...m.segments, { kind: "text", text: ev.text }],
      };
    }
    case "text_done": {
      // Replace the trailing streaming-text segment with the authoritative
      // full text — guards against any deltas we may have dropped.
      const last = m.segments[m.segments.length - 1];
      if (last && last.kind === "text") {
        const updated: AssistantSegment = { kind: "text", text: ev.text };
        return { ...m, segments: [...m.segments.slice(0, -1), updated] };
      }
      return { ...m, segments: [...m.segments, { kind: "text", text: ev.text }] };
    }
    case "tool_use_start": {
      const tc: ToolCall = {
        id: ev.id,
        name: ev.name,
        input: null,
        result: undefined,
        isError: false,
        durationMs: null,
        status: "starting",
      };
      return {
        ...m,
        segments: [...m.segments, { kind: "tool", toolId: ev.id }],
        toolCalls: { ...m.toolCalls, [ev.id]: tc },
      };
    }
    case "tool_use_input": {
      const prev = m.toolCalls[ev.id];
      const updated: ToolCall = {
        id: ev.id,
        name: ev.name,
        input: ev.input,
        result: prev?.result,
        isError: prev?.isError ?? false,
        durationMs: prev?.durationMs ?? null,
        status: "running",
      };
      return { ...m, toolCalls: { ...m.toolCalls, [ev.id]: updated } };
    }
    case "tool_result": {
      const prev = m.toolCalls[ev.id];
      const updated: ToolCall = {
        id: ev.id,
        name: ev.name,
        input: prev?.input ?? null,
        result: ev.result,
        isError: ev.is_error,
        durationMs: ev.duration_ms,
        status: ev.is_error ? "error" : "done",
      };
      return { ...m, toolCalls: { ...m.toolCalls, [ev.id]: updated } };
    }
    default:
      return m;
  }
}

function kindForFile(f: File): string {
  const n = f.name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".csv")) return "csv";
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "xlsx";
  if (f.type.startsWith("image/")) return "image";
  return "file";
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
