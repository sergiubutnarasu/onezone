import { type AgentOutputParser } from "./types.js";

// Copilot CLI emits one JSON object per line (JSONL). Unlike Claude Code,
// Copilot does NOT include token counts or a result text in the final
// `result` message. Instead:
//   - `outputTokens` appears per-turn on `assistant.message` lines
//     (under `data.outputTokens`).
//   - `premiumRequests` (a cost metric, not USD) appears under the top-level
//     `usage` object in the final `result` message.
//   - There is no `inputTokens` field anywhere in the output.
//   - There is no `data.result` text field; the final assistant text is in
//     the last `assistant.message`'s `data.content`.
//
// To surface totals on the `result` line (which is what the command-runner
// uses for the COMMAND_EXIT payload), the parser must be stateful and
// accumulate `outputTokens` across all `assistant.message` lines.
export function createCopilotParser(): AgentOutputParser {
  let accumulatedOutputTokens = 0;

  return (line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return undefined;
    }

    const type = (parsed as { type?: string })?.type;

    // Accumulate output tokens from each assistant message turn.
    if (type === "assistant.message") {
      const data = (parsed as { data?: Record<string, unknown> }).data;
      const outputTokens =
        typeof data?.outputTokens === "number" ? data.outputTokens : 0;
      accumulatedOutputTokens += outputTokens;

      const content =
        typeof data?.content === "string" ? data.content : undefined;
      return {
        content: content || undefined,
        outputTokens,
      };
    }

    if (type !== "result") {
      return undefined;
    }

    // The `result` message has a top-level `usage` object (no `data` field).
    const usage = (parsed as { usage?: Record<string, unknown> }).usage;
    const premiumRequests =
      typeof usage?.premiumRequests === "number"
        ? usage.premiumRequests
        : undefined;

    return {
      result: {
        usage: {
          // Copilot does not report USD cost; premiumRequests is the only
          // cost-related metric available.
          totalCostUsd: premiumRequests,
          outputTokens: accumulatedOutputTokens,
        },
        nextColumnId: undefined,
        finished: true,
      },
    };
  };
}
