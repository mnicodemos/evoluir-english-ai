// Hybrid AI layer: try the browser's built-in language model first
// (Chrome Prompt API — window.ai.languageModel / LanguageModel) and fall back
// to the cloud Gemini call when the local model is unavailable or fails.

import { aiChat } from "@/lib/aiChat.functions";
import type { AiMsg } from "@/lib/ai-prompts";

type LocalAvailability = "unavailable" | "after-download" | "available";

interface LocalSession {
  prompt(input: string): Promise<string>;
  destroy(): void;
}

interface LocalLanguageModel {
  availability(): Promise<LocalAvailability>;
  create(options?: {
    systemPrompt?: string;
    initialPrompts?: { role: string; content: string }[];
    monitor?: (m: { addEventListener(type: "downloadprogress", listener: (e: { loaded: number }) => void): void }) => void;
  }): Promise<LocalSession>;
}

declare global {
  interface Window {
    ai?: { languageModel?: LocalLanguageModel };
    LanguageModel?: LocalLanguageModel;
  }
}

function localApi(): LocalLanguageModel | undefined {
  if (typeof window === "undefined") return undefined;
  return window.LanguageModel ?? window.ai?.languageModel;
}

/** True when the browser offers a built-in language model (Chrome 127+ / Edge). */
export async function isLocalAiAvailable(): Promise<boolean> {
  const api = localApi();
  if (!api) return false;
  try {
    const status = await api.availability();
    return status === "available" || status === "after-download";
  } catch {
    return false;
  }
}

/**
 * Runs the conversation locally. Throws when the local model cannot answer,
 * so callers can fall back to the cloud.
 */
async function promptLocally(messages: AiMsg[]): Promise<string> {
  const api = localApi();
  if (!api) throw new Error("Local AI not supported by this browser.");

  const status = await api.availability();
  if (status === "unavailable") throw new Error("Local AI is unavailable on this device.");

  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const history = messages.filter((m) => m.role !== "system");
  const last = history[history.length - 1];
  if (!last || last.role !== "user") throw new Error("Local AI needs a user message to answer.");

  // Fresh session per call: the system prompt and prior turns go in as
  // initialPrompts, then the latest user message is prompted.
  const session = await api.create({
    ...(system ? { systemPrompt: system } : {}),
    initialPrompts: history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
  });
  try {
    const text = (await session.prompt(last.content)).trim();
    if (!text) throw new Error("Local AI returned an empty answer.");
    return text;
  } finally {
    session.destroy();
  }
}

/**
 * Hybrid entry point: local browser model first, cloud Gemini as fallback.
 * Returns the raw model text (JSON string when the prompt asked for JSON).
 */
export async function hybridChat(messages: AiMsg[], jsonMode = false): Promise<string> {
  try {
    if (await isLocalAiAvailable()) {
      return await promptLocally(messages);
    }
  } catch (error) {
    console.warn("Local AI failed, falling back to cloud Gemini:", error);
  }
  return aiChat({ data: { messages, jsonMode } });
}
