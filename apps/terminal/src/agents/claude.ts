import { AgentTag, type UnifiedContentBlock } from "@onezone/shared";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getProjectConfigFolder,
  getProjectWorkDir,
  getRulesContent,
  isRtkAvailable,
} from "../lib/project-paths.js";
import { AgentEventType, type AgentConfig, type AgentEvent, type AgentRunParams, parseNextColumnTag } from "../lib/types/index.js";

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const configPath = getProjectConfigFolder(projectId);
  const workDir = getProjectWorkDir(projectId);
  const systemRules = getRulesContent();

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
        settings: {
          permissions: {
            allow: [
              `Bash(*)`,
              `Edit(/${workDir})`,
              `Read(/${workDir})`,
              `Read(/${configPath})`,
              `Write(/${workDir})`,
              `Glob`,
              `Grep`,
              `WebSearch`,
              `WebFetch(domain:*)`,
              `Agent`,
              `TodoWrite`,
            ],
          },
          ...(isRtkAvailable() && {
            hooks: {
              PreToolUse: [
                {
                  matcher: "Bash",
                  hooks: [{ type: "command", command: "rtk hook claude" }],
                },
              ],
            },
          }),
        },
        sandbox: {
          filesystem: {
            allowWrite: [`/${workDir}`],
            allowRead: [`/${workDir}`, `/${configPath}`],
          },
        },
        env: {
          ...process.env,
          CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1",
        },
        includePartialMessages: false,
        ...(systemRules
          ? {
              systemPrompt: {
                type: "preset",
                preset: "claude_code",
                append: systemRules,
              },
            }
          : {}),
      },
    })) {
      // Emit unified content blocks so the web frontend never has to
      // branch on agent type.  Each Text event is a JSON array of
      // UnifiedContentBlock objects.
      const blocks: UnifiedContentBlock[] = [];

      switch (message.type) {
        case "assistant": {
          const contentBlocks = message.message?.content as unknown[] | undefined;
          if (Array.isArray(contentBlocks)) {
            for (const block of contentBlocks) {
              if (!block || typeof block !== "object") continue;
              const b = block as Record<string, unknown>;
              if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
                blocks.push({ kind: "text", text: b.text });
              } else if (b.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
                blocks.push({ kind: "thinking", text: b.thinking });
              } else if (b.type === "tool_use" && typeof b.name === "string") {
                blocks.push({ kind: "tool_use", name: b.name, input: (b.input as Record<string, unknown>) ?? {} });
              }
            }
          }
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
        case "user": {
          const contentBlocks = message.message?.content as unknown[] | undefined;
          if (Array.isArray(contentBlocks)) {
            for (const block of contentBlocks) {
              if (!block || typeof block !== "object") continue;
              const b = block as Record<string, unknown>;
              if (b.type === "tool_result") {
                const text = extractToolResultText(b.content);
                if (text) blocks.push({ kind: "tool_result", text });
              }
            }
          }
          break;
        }
        case "result": {
          if (message.subtype !== "success") break;
          const resultText = message.result;
          if (resultText && resultText.trim()) {
            blocks.push({ kind: "text", text: resultText });
          }
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

      if (blocks.length > 0) {
        yield { type: AgentEventType.Text, content: JSON.stringify(blocks) };
      }
    }
  }

  return {
    tag: AgentTag.ClaudeCode,
    run,
  };
};

function extractToolResultText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (
    content &&
    typeof content === "object" &&
    "text" in content &&
    typeof (content as Record<string, unknown>).text === "string"
  ) {
    return (content as Record<string, unknown>).text as string;
  }
  return null;
}
