import { AgentTag, type UnifiedContentBlock } from "@onezone/shared";
import { spawn } from "node:child_process";
import {
  AgentEventType,
  parseNextColumnTag,
  type AgentConfig,
  type AgentEvent,
  type AgentRunParams,
} from "../lib/types/index.js";

export const setup = ({
  projectId,
  model,
  agentName,
}: {
  projectId: string;
  model: string;
  agentName: string;
}): AgentConfig => {
  void projectId;

  async function* run({ prompt, cwd, signal }: AgentRunParams): AsyncIterable<AgentEvent> {
    // --format / --json-strict are GLOBAL acpx flags and must precede the
    // agent subcommand, otherwise acpx rejects them as unknown options.
    const args = ["--format", "json", "--json-strict", agentName, "exec", prompt];
    const child = spawn("acpx", args, { cwd, env: process.env });

    const blocks: UnifiedContentBlock[] = [];
    let resultEmitted = false;

    const emitBlocks = (): void => {
      if (blocks.length > 0) {
        // yield is not allowed inside a callback; collect and flush via queue
      }
    };

    // Use a line-buffered reader over stdout.
    let buffer = "";
    const queue: AgentEvent[] = [];
    let resolveQueue: (() => void) | undefined;
    let done = false;
    const flush = () => {
      if (queue.length > 0) resolveQueue?.();
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as Record<string, unknown>;
          const ev = mapMessage(msg);
          if (ev) queue.push(ev);
        } catch {
          // skip malformed line
        }
      }
      flush();
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      queue.push({ type: AgentEventType.Stderr, content: chunk });
      flush();
    });

    const abort = () => {
      done = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
      resolveQueue?.();
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();

    child.on("close", (code) => {
      done = true;
      if (code !== 0 && !signal.aborted) {
        queue.push({ type: AgentEventType.Stderr, content: `acpx exited with code ${code}` });
      }
      resolveQueue?.();
    });

    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((res) => { resolveQueue = res; });
        resolveQueue = undefined;
        continue;
      }
      const ev = queue.shift()!;
      yield ev;
    }
  }

  return { tag: agentNameToTag(agentName), run };
};

function agentNameToTag(agentName: string): AgentTag {
  switch (agentName) {
    case "claude": return AgentTag.ClaudeCode;
    case "copilot": return AgentTag.GithubCopilotCLI;
    case "opencode": return AgentTag.Opencode;
    default: return AgentTag.ClaudeCode;
  }
}

function mapMessage(msg: Record<string, unknown>): AgentEvent | null {
  if (msg.method === "session/update") {
    const params = (msg.params ?? {}) as Record<string, unknown>;
    const update = params.sessionUpdate as string | undefined;
    const content = params.content as Record<string, unknown> | undefined;
    if (update === "agent_message_chunk" && content) {
      const type = content.type as string | undefined;
      if (type === "text" && typeof content.text === "string" && content.text.trim()) {
        return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "text", text: content.text }]) };
      }
      if (type === "thinking" && typeof content.thinking === "string" && content.thinking.trim()) {
        return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "thinking", text: content.thinking }]) };
      }
    }
    if (update === "agent_message" && content) {
      const blocks: UnifiedContentBlock[] = [];
      if (typeof content.text === "string" && content.text.trim()) {
        blocks.push({ kind: "text", text: content.text });
      }
      if (blocks.length > 0) {
        return { type: AgentEventType.Text, content: JSON.stringify(blocks) };
      }
    }
    if (update === "tool_call" && content) {
      const name = (content.name as string) ?? "tool";
      const input = (content.input as Record<string, unknown>) ?? {};
      return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "tool_use", name, input }]) };
    }
    if (update === "tool_call_result" && content) {
      const text = extractText(content);
      if (text) return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "tool_result", text }]) };
    }
  }
  if (msg.id !== undefined && msg.result !== undefined) {
    const result = msg.result as Record<string, unknown>;
    const resultText = typeof result.result === "string" ? result.result : undefined;
    const usage = result.usage as Record<string, unknown> | undefined;
    return {
      type: AgentEventType.Result,
      content: resultText,
      usage: {
        totalCostUsd: typeof result.total_cost_usd === "number" ? result.total_cost_usd : undefined,
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined,
      },
      nextColumnId: resultText ? parseNextColumnTag(resultText) : undefined,
      finished: true,
    };
  }
  return null;
}

function extractText(content: Record<string, unknown>): string | null {
  if (typeof content.text === "string" && content.text.trim()) return content.text;
  if (typeof content.content === "string" && content.content.trim()) return content.content;
  return null;
}
