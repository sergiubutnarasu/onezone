import {
  type AgentOutputParser,
  parseNextColumnTag,
  type ParsedAgentLine,
} from "./types.js";

function extractClaudeContent(message: unknown): string | undefined {
  const textBlocks = Array.isArray((message as { content?: unknown })?.content)
    ? ((message as { content: { type?: string; text?: string }[] }).content)
    : [];
  const text = textBlocks
    .filter((b) => b?.type === "text")
    .map((b) => b.text)
    .join("");
  return text || undefined;
}

export const parseClaudeStreamJsonLine: AgentOutputParser = (line) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }

  const type = (parsed as { type?: string })?.type;

  switch (type) {
    case "assistant": {
      const message = (parsed as { message?: unknown }).message;
      const usage = (
        message as {
          usage?: { input_tokens?: number; output_tokens?: number };
        } | undefined
      )?.usage;
      return {
        content: extractClaudeContent(message),
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
      };
    }
    case "result": {
      const resultText =
        typeof (parsed as { result?: unknown }).result === "string"
          ? (parsed as { result: string }).result
          : undefined;
      const usage = (parsed as {
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
        total_cost_usd?: number;
      }).usage;
      return {
        content: resultText,
        result: {
          usage: {
            totalCostUsd: (parsed as { total_cost_usd?: number }).total_cost_usd,
            inputTokens: usage?.input_tokens,
            outputTokens: usage?.output_tokens,
          },
          nextColumnId: resultText
            ? parseNextColumnTag(resultText)
            : undefined,
          finished: true,
        },
      };
    }
    default:
      return undefined;
  }
};

export function createClaudeParser(): AgentOutputParser {
  return parseClaudeStreamJsonLine;
}
