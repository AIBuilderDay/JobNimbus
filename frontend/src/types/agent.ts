import { z } from "zod";

/**
 * Agent SSE event taxonomy. Mirrors backend/agent/runner.py — every shape
 * Claude streams to the browser is validated here at the boundary.
 */
export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session"), session_id: z.string() }),
  z.object({ type: z.literal("text_delta"), text: z.string() }),
  z.object({ type: z.literal("text_done"), text: z.string() }),
  z.object({
    type: z.literal("tool_use_start"),
    id: z.string(),
    name: z.string(),
  }),
  z.object({
    type: z.literal("tool_use_input"),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("tool_result"),
    id: z.string(),
    name: z.string(),
    is_error: z.boolean(),
    result: z.unknown(),
    duration_ms: z.number(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({
    type: z.literal("done"),
    stop_reason: z.string().nullable().optional(),
  }),
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

/** UI representations — what the chat actually renders. */
export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown> | null;
  result: unknown;
  isError: boolean;
  durationMs: number | null;
  status: "starting" | "running" | "done" | "error";
};

export type AssistantSegment =
  | { kind: "text"; text: string }
  | { kind: "tool"; toolId: string };

export type ChatMessage =
  | {
      id: string;
      role: "user";
      text: string;
      attachments: { name: string; kind: string; summary: string }[];
    }
  | {
      id: string;
      role: "assistant";
      segments: AssistantSegment[];
      toolCalls: Record<string, ToolCall>;
      streaming: boolean;
    }
  | {
      id: string;
      role: "system-error";
      text: string;
    };
