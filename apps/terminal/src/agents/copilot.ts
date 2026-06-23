import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { AgentTag, type UnifiedContentBlock } from "@onezone/shared";
import * as fs from "fs";
import * as path from "path";
import { getProjectConfigFolder } from "../lib/project-paths.js";
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

  const skillsDirs = [githubSkillsDir, agentsSkillsDir].filter((dir) =>
    fs.existsSync(dir),
  );

  async function* run({
    prompt,
    cwd,
    signal,
  }: AgentRunParams): AsyncIterable<AgentEvent> {
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
      env,
    });

    await client.start();

    try {
      const session = await client.createSession({
        model,
        ...(provider ? { provider } : {}),
        onPermissionRequest: approveAll,
        streaming: true,
        enableSkills: true,
        ...(instructionsDirs.length > 0
          ? { instructionDirectories: instructionsDirs }
          : {}),
        ...(skillsDirs.length > 0 ? { skillDirectories: skillsDirs } : {}),
      });

      let lastAssistantContent: string | undefined;
      let lastUsageTokens: { inputTokens?: number; outputTokens?: number } = {};

      const eventQueue: AgentEvent[] = [];
      let resolveEvent: (() => void) | undefined;
      let done = false;

      const enqueue = (event: AgentEvent) => {
        eventQueue.push(event);
        resolveEvent?.();
      };

      // Emit unified content blocks so the web frontend never has to
      // branch on agent type.  Each Text event is a JSON array of
      // UnifiedContentBlock objects.
      const enqueueBlocks = (blocks: UnifiedContentBlock[]) => {
        if (blocks.length > 0) {
          enqueue({
            type: AgentEventType.Text,
            content: JSON.stringify(blocks),
          });
        }
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

        const blocks: UnifiedContentBlock[] = [];
        if (typeof content === "string" && content.trim()) {
          blocks.push({ kind: "text", text: content });
        }

        const toolRequests = Array.isArray(
          (data as unknown as Record<string, unknown>).toolRequests,
        )
          ? ((data as unknown as Record<string, unknown>)
              .toolRequests as Record<string, unknown>[])
          : [];
        for (const req of toolRequests) {
          if (!req || typeof req !== "object") continue;
          const name = typeof req.name === "string" ? req.name : "tool";
          const input =
            (req.arguments as Record<string, unknown> | undefined) ?? {};
          blocks.push({ kind: "tool_use", name, input });
        }

        enqueueBlocks(blocks);

        const outputTokens = data.outputTokens;
        if (outputTokens !== undefined) {
          enqueue({ type: AgentEventType.Usage, outputTokens });
        }
      });

      session.on("assistant.reasoning", (event) => {
        const data = event.data as unknown as Record<string, unknown>;
        const reasoning =
          typeof data?.reasoning === "string" ? data.reasoning : null;
        if (reasoning && reasoning.trim()) {
          enqueueBlocks([{ kind: "thinking", text: reasoning }]);
        }
      });

      session.on("tool.execution_start", (event) => {
        const data = event.data as unknown as Record<string, unknown>;
        const name = typeof data?.name === "string" ? data.name : "tool";
        const input =
          (data?.arguments as Record<string, unknown> | undefined) ?? {};
        enqueueBlocks([{ kind: "tool_use", name, input }]);
      });

      session.on("tool.execution_complete", (event) => {
        const data = event.data as unknown as Record<string, unknown>;
        const result = data?.result as Record<string, unknown> | undefined;
        const resultContent =
          typeof result?.content === "string" ? result.content : null;
        const partialOutput =
          typeof data?.partialOutput === "string" ? data.partialOutput : null;
        const text = resultContent ?? partialOutput;
        if (text && text.trim()) {
          enqueueBlocks([{ kind: "tool_result", text }]);
        }
      });

      session.on("tool.execution_partial_result", (event) => {
        const data = event.data as unknown as Record<string, unknown>;
        const result = data?.result as Record<string, unknown> | undefined;
        const resultContent =
          typeof result?.content === "string" ? result.content : null;
        const partialOutput =
          typeof data?.partialOutput === "string" ? data.partialOutput : null;
        const text = resultContent ?? partialOutput;
        if (text && text.trim()) {
          enqueueBlocks([{ kind: "tool_result", text }]);
        }
      });

      session.on("assistant.usage", (event) => {
        const usage = event.data;
        lastUsageTokens = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        };
        enqueue({
          type: AgentEventType.Usage,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        });
      });

      session.on("session.idle", () => {
        enqueue({
          type: AgentEventType.Result,
          content: lastAssistantContent,
          usage: lastUsageTokens,
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
            inputTokens:
              typeof inputDetail === "object"
                ? inputDetail.tokenCount
                : lastUsageTokens.inputTokens,
            outputTokens:
              typeof outputDetail === "object"
                ? outputDetail.tokenCount
                : lastUsageTokens.outputTokens,
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
