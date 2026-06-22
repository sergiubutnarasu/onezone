import { AgentTag } from "@onezone/shared";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getClaudeSettingsPath,
  getProjectConfigFolder,
} from "../lib/project-paths.js";
import { AgentEventType, type AgentConfig, type AgentEvent, type AgentRunParams, parseNextColumnTag } from "../lib/types/index.js";

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const settingsPath = getClaudeSettingsPath(projectId);
  const configPath = getProjectConfigFolder(projectId);

  async function* run({ prompt, cwd, signal }: AgentRunParams): AsyncIterable<AgentEvent> {
    const abortController = new AbortController();
    signal.addEventListener("abort", () => abortController.abort());

    for await (const message of query({
      prompt,
      options: {
        model,
        cwd,
        abortController,
        additionalDirectories: [`/${configPath}`],
        settings: settingsPath,
        env: {
          ...process.env,
          CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1",
        },
        includePartialMessages: false,
      },
    })) {
      // The web frontend parses the raw stream-json line to extract
      // text, thinking, tool_use, and tool_result blocks. Emit the
      // SDK message as JSON so the frontend parser can handle it.
      yield { type: AgentEventType.Text, content: JSON.stringify(message) };

      switch (message.type) {
        case "assistant": {
          const usage = message.message.usage;
          if (usage) {
            yield {
              type: AgentEventType.Usage,
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
            };
          }
          break;
        }
        case "result": {
          if (message.subtype !== "success") break;
          const resultText = message.result;
          yield {
            type: AgentEventType.Result,
            content: resultText,
            usage: {
              totalCostUsd: message.total_cost_usd,
              inputTokens: message.usage?.input_tokens,
              outputTokens: message.usage?.output_tokens,
            },
            nextColumnId: resultText ? parseNextColumnTag(resultText) : undefined,
            finished: true,
          };
          break;
        }
        default:
          break;
      }
    }
  }

  return {
    tag: AgentTag.ClaudeCode,
    run,
  };
};
