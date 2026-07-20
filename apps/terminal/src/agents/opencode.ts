import {
  createOpencodeClient,
  createOpencodeServer,
  type Config as OpencodeConfig,
} from "@opencode-ai/sdk";
import { AgentTag, type UnifiedContentBlock } from "@onezone/shared";
import * as fs from "fs";
import * as path from "path";
import { getProjectConfigFolder, getRulesContent } from "../lib/project-paths.js";
import {
  AgentEventType,
  parseNextColumnTag,
  type AgentConfig,
  type AgentEvent,
  type AgentRunParams,
} from "../lib/types/index.js";

// --- Singleton server management ---
// Starts the opencode server lazily on first use and reuses it for all
// subsequent agent runs (including parallel ones).

let serverPromise: Promise<{ url: string; close(): void }> | undefined;

async function getOpencodeServer(model?: string, skillsPaths?: string[]): Promise<string> {
  if (!serverPromise) {
    const providerID = process.env.OPENCODE_PROVIDER_ID ?? "default";
    const providerBaseURL = process.env.OPENCODE_PROVIDER_BASE_URL;
    const providerApiKey = process.env.OPENCODE_PROVIDER_API_KEY;

    // Build provider config from env vars so the opencode server knows how
    // to reach the LLM provider (e.g. Ollama Cloud, OpenAI-compatible, etc.)
    const config: OpencodeConfig = {};

    if (providerBaseURL && providerID !== "default") {
      config.provider = {
        [providerID]: {
          npm: "@ai-sdk/openai-compatible",
          name: providerID,
          options: {
            baseURL: providerBaseURL,
            ...(providerApiKey ? { apiKey: providerApiKey } : {}),
          },
          // Register the model so the server recognizes it under this provider
          ...(model
            ? {
                models: {
                  [model]: { name: model },
                },
              }
            : {}),
        },
      };
    }

    // Pass skills directories to the server so it can discover project skills
    const existingSkillPaths = (skillsPaths ?? []).filter((p) =>
      fs.existsSync(p),
    );
    if (existingSkillPaths.length > 0) {
      (config as unknown as Record<string, unknown>).skills = {
        paths: existingSkillPaths,
      };
    }

    // Auto-allow all tool permissions — the server runs in a trusted
    // environment and the workdir is already sandboxed at the OS level.
    config.permission = {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      external_directory: "allow",
    };

    serverPromise = createOpencodeServer({
      hostname: "127.0.0.1",
      port: 4096,
      config,
    });
  }
  const { url } = await serverPromise;
  return url;
}

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const configPath = getProjectConfigFolder(projectId);
  const opencodeDir = path.join(configPath, ".opencode");
  const skillsPaths = [
    path.join(opencodeDir, "skills"),
    path.join(configPath, ".agents", "skills"),
  ];

  // Load project rules from the bundled static folder
  const systemRules = getRulesContent();

  async function* run({
    prompt,
    cwd,
    signal,
  }: AgentRunParams): AsyncIterable<AgentEvent> {
    const providerID = process.env.OPENCODE_PROVIDER_ID ?? "default";

    // Start (or reuse) the singleton opencode server
    let serverUrl: string;
    try {
      serverUrl = await getOpencodeServer(model, skillsPaths);
    } catch (err) {
      yield {
        type: AgentEventType.Stderr,
        content: `Failed to start OpenCode server: ${(err as Error).message}`,
      };
      return;
    }

    const client = createOpencodeClient({ baseUrl: serverUrl });

    // Create a new session for this run
    const createRes = await client.session.create({
      query: { directory: cwd },
    });
    if (!createRes.data) {
      yield {
        type: AgentEventType.Stderr,
        content: "Failed to create OpenCode session",
      };
      return;
    }
    const sessionId = createRes.data.id;

    const eventQueue: AgentEvent[] = [];
    let resolveEvent: (() => void) | undefined;
    let done = false;
    let lastAssistantContent = "";
    let lastUsageTokens: { inputTokens?: number; outputTokens?: number } = {};
    const abort = () => {
      done = true;
      resolveEvent?.();
      void client.session.abort({
        path: { id: sessionId },
        query: { directory: cwd },
      }).catch(() => undefined);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();

    const enqueue = (event: AgentEvent) => {
      eventQueue.push(event);
      resolveEvent?.();
    };

    const enqueueBlocks = (blocks: UnifiedContentBlock[]) => {
      if (blocks.length > 0) {
        enqueue({
          type: AgentEventType.Text,
          content: JSON.stringify(blocks),
        });
      }
    };

    // Helper to extract session ID from an event payload
    const getEventSessionId = (event: { type: string; properties?: unknown }): string | undefined => {
      if (!event.properties || typeof event.properties !== "object") return undefined;
      const props = event.properties as Record<string, unknown>;

      // Direct sessionID in properties (session.idle, session.error)
      if (typeof props.sessionID === "string") return props.sessionID;

      // In part (message.part.updated)
      const part = props.part as Record<string, unknown> | undefined;
      if (part && typeof part.sessionID === "string") return part.sessionID;

      // In info/message (message.updated)
      const info = props.info as Record<string, unknown> | undefined;
      if (info && typeof info.sessionID === "string") return info.sessionID;

      return undefined;
    };

    // Start listening to events before sending the message
    const eventStreamPromise = (async () => {
      try {
        const { stream } = await client.global.event();

        for await (const globalEvent of stream) {
          if (signal.aborted) break;

          const event = globalEvent.payload;
          const eventSessionId = getEventSessionId(event);

          // Filter events to only those for our session
          if (eventSessionId && eventSessionId !== sessionId) continue;

          switch (event.type) {
            case "message.part.updated": {
              const part = event.properties.part;
              if (!part) break;

              switch (part.type) {
                case "text": {
                  const text = (part as { text?: string }).text;
                  if (text && text.trim()) {
                    lastAssistantContent += text;
                    enqueueBlocks([{ kind: "text", text }]);
                  }
                  break;
                }
                case "reasoning": {
                  const reasoning = (part as { text?: string }).text;
                  if (reasoning && reasoning.trim()) {
                    enqueueBlocks([{ kind: "thinking", text: reasoning }]);
                  }
                  break;
                }
                case "tool": {
                  const toolPart = part as {
                    tool?: string;
                    callID?: string;
                    state?: { status: string; input?: Record<string, unknown>; output?: string; error?: string; title?: string };
                  };
                  const toolName = toolPart.tool ?? "tool";
                  const state = toolPart.state;

                  if (state?.status === "pending" || state?.status === "running") {
                    enqueueBlocks([{
                      kind: "tool_use",
                      name: toolName,
                      input: state.input ?? {},
                    }]);
                  } else if (state?.status === "completed") {
                    const output = state.output;
                    if (output && output.trim()) {
                      enqueueBlocks([{ kind: "tool_result", text: output }]);
                    }
                  } else if (state?.status === "error") {
                    const error = state.error ?? "Unknown error";
                    enqueueBlocks([{ kind: "tool_result", text: `Error: ${error}` }]);
                  }
                  break;
                }
                case "step-start": {
                  // Step start markers — no content to emit
                  break;
                }
                case "step-finish": {
                  const stepFinish = part as {
                    tokens?: { input?: number; output?: number; reasoning?: number };
                  };
                  const tokens = stepFinish.tokens;
                  if (tokens) {
                    lastUsageTokens = {
                      inputTokens: tokens.input,
                      outputTokens: tokens.output,
                    };
                    enqueue({
                      type: AgentEventType.Usage,
                      inputTokens: tokens.input,
                      outputTokens: tokens.output,
                    });
                  }
                  break;
                }
                default:
                  break;
              }
              break;
            }
            case "message.updated": {
              const message = event.properties.info;
              if (message?.role === "assistant") {
                const assistantMsg = message as {
                  tokens?: { input?: number; output?: number; reasoning?: number };
                };
                const tokens = assistantMsg.tokens;
                if (tokens) {
                  lastUsageTokens = {
                    inputTokens: tokens.input,
                    outputTokens: tokens.output,
                  };
                  enqueue({
                    type: AgentEventType.Usage,
                    inputTokens: tokens.input,
                    outputTokens: tokens.output,
                  });
                }
              }
              break;
            }
            case "session.idle": {
              enqueue({
                type: AgentEventType.Result,
                content: lastAssistantContent || undefined,
                usage: lastUsageTokens,
                nextColumnId: lastAssistantContent
                  ? parseNextColumnTag(lastAssistantContent)
                  : undefined,
                finished: true,
              });
              done = true;
              resolveEvent?.();
              break;
            }
            case "session.error": {
              console.log("OpenCode session.error event:", JSON.stringify(event));
              const error = event.properties.error;
              const errorMessage =
                error && typeof error === "object" && "error" in error
                  ? String((error as { error?: unknown }).error)
                  : "OpenCode session error";
              enqueue({
                type: AgentEventType.Stderr,
                content: errorMessage,
              });
              done = true;
              resolveEvent?.();
              break;
            }
            default:
              break;
          }
        }

        // Stream ended normally without a session.idle event. This can
        // happen if the SSE connection drops silently. Emit a Result
        // with whatever content was accumulated so the generator and
        // command-runner can finish cleanly instead of hanging forever.
        if (!done) {
          if (!signal.aborted) {
            enqueue({
              type: AgentEventType.Result,
              content: lastAssistantContent || undefined,
              usage: lastUsageTokens,
              nextColumnId: lastAssistantContent
                ? parseNextColumnTag(lastAssistantContent)
                : undefined,
              finished: true,
            });
          }
          done = true;
          resolveEvent?.();
        }
      } catch (err) {
        if (!signal.aborted) {
          enqueue({
            type: AgentEventType.Stderr,
            content: `OpenCode event stream error: ${(err as Error).message}`,
          });
        }
        done = true;
        resolveEvent?.();
      }
    })();

    // Send the prompt using promptAsync so the HTTP call returns
    // immediately (204) instead of blocking until the full response is
    // generated.  This lets the generator yield events as they arrive
    // from the SSE event stream rather than buffering everything until
    // the session finishes.
    try {
      await client.session.promptAsync({
        path: { id: sessionId },
        query: { directory: cwd },
        body: {
          model: {
            providerID: providerID ?? "default",
            modelID: model,
          },
          ...(systemRules ? { system: systemRules } : {}),
          parts: [{ type: "text", text: prompt }],
        },
      });
    } catch (err) {
      enqueue({
        type: AgentEventType.Stderr,
        content: `OpenCode chat error: ${(err as Error).message}`,
      });
      done = true;
      resolveEvent?.();
    }

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

    // Clean up: abort the session
    signal.removeEventListener("abort", abort);
    try {
      await client.session.abort({
        path: { id: sessionId },
        query: { directory: cwd },
      });
    } catch {
      // Ignore cleanup errors
    }

    // Don't wait for the event stream to finish — the SSE connection
    // is long-lived and won't close on its own. The event stream IIFE
    // will end when the SSE connection eventually drops or the process
    // exits. Waiting here would hang the generator forever.
    // await eventStreamPromise.catch(() => {});
  }

  return {
    tag: AgentTag.Opencode,
    run,
  };
};
