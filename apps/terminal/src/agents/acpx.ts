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

  // Headless runs have no human to approve permission prompts. acpx denies any
  // tool not explicitly approved, which makes the child agent fail with exit
  // code 5 (PERMISSION_DENIED). Mirror the old per-SDK allowlist by auto-approving
  // the tools an agent needs (Bash, edits/reads/writes in the workdir, glob,
  // grep, web search, etc.) via acpx's --permission-policy.
  const permissionPolicy = {
    defaultAction: "approve" as const,
    autoApprove: [
      "Bash(*)",
      "Edit(/*)",
      "Read(/*)",
      "Write(/*)",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch(domain:*)",
      "Agent",
      "TodoWrite",
    ],
  };
  const permissionPolicyJson = JSON.stringify(permissionPolicy);

  async function* run({ prompt, cwd, signal }: AgentRunParams): AsyncIterable<AgentEvent> {
    // --format / --json-strict are GLOBAL acpx flags and must precede the
    // agent subcommand, otherwise acpx rejects them as unknown options.
    // --model and --permission-policy are also global flags.
    const args = [
      "--format", "json", "--json-strict",
      "--permission-policy", permissionPolicyJson,
      ...(model ? ["--model", model] : []),
      agentName, "exec", prompt,
    ];
    console.error(`[acpx] spawning: acpx ${args.join(" ")} (cwd=${cwd})`);
    const child = spawn("acpx", args, { cwd, env: process.env });
    child.on("error", (err) => {
      // spawn failures (e.g. acpx not on PATH) land here, not on 'close'
      console.error(`[acpx] spawn error: ${err.message}`);
      queue.push({ type: AgentEventType.Stderr, content: `acpx spawn error: ${err.message}` });
      flush();
    });

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
    let stderrBuf = "";
    child.stderr.on("data", (chunk: string) => {
      stderrBuf += chunk;
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

    child.on("close", (code, closeSignal) => {
      done = true;
      if (code !== 0 && !signal.aborted) {
        // Log the real reason so failures are diagnosable, not just "code 1".
        const stderr = stderrBuf.trim();
        console.error(
          `[acpx] exited with code ${code ?? "null"} signal=${closeSignal ?? "null"}` +
            (stderr ? `\n[acpx] stderr: ${stderr}` : ""),
        );
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
  // acpx surfaces failures as JSON-RPC error responses on stdout (not stderr).
  if (msg.id !== undefined && msg.error !== undefined) {
    const err = msg.error as Record<string, unknown>;
    const errText =
      typeof err.message === "string"
        ? `acpx error: ${err.message}${typeof err.code !== "undefined" ? ` (code ${err.code})` : ""}`
        : `acpx error: ${JSON.stringify(err)}`;
    console.error(`[acpx] ${errText}`);
    return { type: AgentEventType.Stderr, content: errText };
  }
  return null;
}

function extractText(content: Record<string, unknown>): string | null {
  if (typeof content.text === "string" && content.text.trim()) return content.text;
  if (typeof content.content === "string" && content.content.trim()) return content.content;
  return null;
}
