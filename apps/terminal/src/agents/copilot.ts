import { AgentTag } from "@onezone/shared";
import { CopilotClient, approveAll } from "@github/copilot-sdk";
import * as fs from "fs";
import * as path from "path";
import {
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
  const configPath = getProjectConfigFolder(projectId);
  const githubDir = path.join(configPath, ".github");
  const githubSkillsDir = path.join(githubDir, "skills");
  const agentsSkillsDir = path.join(configPath, ".agents", "skills");

  const instructionsDirs = [configPath].filter((dir) =>
    fs.existsSync(path.join(dir, ".github", "instructions")),
  );

  const skillsDirs = [githubSkillsDir, agentsSkillsDir]
    .filter((dir) => fs.existsSync(dir))
    .join(",");

  async function* run({ prompt, cwd, signal }: AgentRunParams): AsyncIterable<AgentEvent> {
    const providerBaseUrl = process.env.COPILOT_PROVIDER_BASE_URL;
    const providerApiKey = process.env.COPILOT_PROVIDER_API_KEY;
    const providerType = process.env.COPILOT_PROVIDER_TYPE;

    const provider = providerBaseUrl
      ? {
          type: (providerType as "openai" | "azure" | "anthropic") || "openai",
          baseUrl: providerBaseUrl,
          ...(providerApiKey ? { apiKey: providerApiKey } : {}),
        }
      : undefined;

    // Strip BYOK env vars so the CLI server doesn't auto-enter BYOK mode at startup.
    // We pass the provider config explicitly via createSession instead.
    const env = { ...process.env };
    delete env.COPILOT_PROVIDER_BASE_URL;
    delete env.COPILOT_PROVIDER_API_KEY;
    delete env.COPILOT_PROVIDER_TYPE;

    const client = new CopilotClient({
      workingDirectory: cwd,
      env: {
        ...env,
        ...(instructionsDirs.length > 0
          ? { COPILOT_CUSTOM_INSTRUCTIONS_DIRS: instructionsDirs.join(",") }
          : {}),
        ...(skillsDirs ? { COPILOT_SKILLS_DIRS: skillsDirs } : {}),
      },
    });

    await client.start();

    try {
      const session = await client.createSession({
        model,
        ...(provider ? { provider } : {}),
        onPermissionRequest: approveAll,
        streaming: true,
      });

      let lastAssistantContent: string | undefined;

      const eventQueue: AgentEvent[] = [];
      let resolveEvent: (() => void) | undefined;
      let done = false;

      const enqueue = (event: AgentEvent) => {
        eventQueue.push(event);
        resolveEvent?.();
      };

      // The web frontend parses raw JSONL lines to extract text, thinking,
      // tool_use, and tool_result blocks. Serialize SDK events to the same
      // shape the CLI JSONL output uses so the frontend parser can handle them.
      const enqueueRaw = (type: string, data: unknown) => {
        enqueue({ type: AgentEventType.Text, content: JSON.stringify({ type, data }) });
      };

      session.on("assistant.message_delta", (event) => {
        // Streaming deltas are not emitted — the full assistant.message
        // event below carries the complete content. Emitting both would
        // duplicate text in the UI.
        void event;
      });

      session.on("assistant.message", (event) => {
        const data = event.data;
        const content = data.content;
        if (content) {
          lastAssistantContent = content;
        }
        // Emit the full message so the frontend can parse tool requests
        enqueueRaw("assistant.message", data);
        const outputTokens = data.outputTokens;
        if (outputTokens !== undefined) {
          enqueue({ type: AgentEventType.Usage, outputTokens });
        }
      });

      session.on("assistant.reasoning", (event) => {
        enqueueRaw("assistant.reasoning", event.data);
      });

      session.on("tool.execution_start", (event) => {
        enqueueRaw("tool.execution_start", event.data);
      });

      session.on("tool.execution_complete", (event) => {
        enqueueRaw("tool.execution_complete", event.data);
      });

      session.on("tool.execution_partial_result", (event) => {
        enqueueRaw("tool.execution_partial_result", event.data);
      });

      session.on("assistant.usage", (event) => {
        enqueue({
          type: AgentEventType.Usage,
          inputTokens: event.data.inputTokens,
          outputTokens: event.data.outputTokens,
        });
      });

      session.on("session.idle", () => {
        enqueue({
          type: AgentEventType.Result,
          content: lastAssistantContent,
          usage: {},
          nextColumnId: lastAssistantContent
            ? parseNextColumnTag(lastAssistantContent)
            : undefined,
          finished: true,
        });
        done = true;
        resolveEvent?.();
      });

      session.on("session.shutdown", (event) => {
        const data = event.data;
        const inputDetail = data.tokenDetails?.input;
        const outputDetail = data.tokenDetails?.output;
        enqueue({
          type: AgentEventType.Result,
          usage: {
            totalCostUsd: data.totalNanoAiu,
            inputTokens: typeof inputDetail === "object" ? inputDetail.tokenCount : undefined,
            outputTokens: typeof outputDetail === "object" ? outputDetail.tokenCount : undefined,
          },
          nextColumnId: lastAssistantContent
            ? parseNextColumnTag(lastAssistantContent)
            : undefined,
          finished: true,
        });
        done = true;
        resolveEvent?.();
      });

      await session.send({ prompt });

      // Yield events as they arrive
      while (!done || eventQueue.length > 0) {
        if (eventQueue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveEvent = resolve;
          });
          resolveEvent = undefined;
        }
        while (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        }
        if (signal.aborted) break;
      }

      await session.disconnect();
    } finally {
      await client.stop();
    }
  }

  return {
    tag: AgentTag.GithubCopilotCLI,
    run,
  };
};
