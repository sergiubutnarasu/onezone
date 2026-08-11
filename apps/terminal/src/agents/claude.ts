import { AgentTag, type UnifiedContentBlock } from "@onezone/shared";
import {
  getProjectConfigFolder,
  getProjectWorkDir,
  getRulesContent,
} from "../lib/project-paths.js";
import {
  AgentEventType,
  type AgentConfig,
  type AgentEvent,
  type AgentRunParams,
} from "../lib/types/index.js";
import { createAcpClient } from "./claude-acp/client.js";
import { finishResult, translateUpdate } from "./claude-acp/translate.js";

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const configPath = getProjectConfigFolder(projectId);
  const workDir = getProjectWorkDir(projectId);
  getRulesContent(); // side-effect parity with prior implementation

  async function* run({
    prompt,
    cwd,
    signal,
  }: AgentRunParams): AsyncIterable<AgentEvent> {
    const acp = await createAcpClient({
      cwd,
      workDir,
      configPath,
      model,
      env: { ...process.env, CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1" },
    });

    const eventQueue: AgentEvent[] = [];
    let resolveEvent: (() => void) | undefined;
    let done = false;

    const abort = () => {
      done = true;
      resolveEvent?.();
      acp.cancel();
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();

    const enqueue = (event: AgentEvent) => {
      eventQueue.push(event);
      resolveEvent?.();
    };

    // Emit unified content blocks so the web frontend never has to
    // branch on agent type. Each Text event is a JSON array of
    // UnifiedContentBlock objects.
    const enqueueBlocks = (blocks: UnifiedContentBlock[]) => {
      if (blocks.length > 0) {
        enqueue({
          type: AgentEventType.Text,
          content: JSON.stringify(blocks),
        });
      }
    };

    acp.onUpdate((update) => {
      const { blocks: newBlocks, event } = translateUpdate(update);
      enqueueBlocks(newBlocks);
      if (event) enqueue(event);
    });

    try {
      const promptPromise = acp.prompt(prompt).then(
        (text) => {
          done = true;
          resolveEvent?.();
          return text;
        },
        (err) => {
          done = true;
          resolveEvent?.();
          throw err;
        },
      );

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

      const resultText = await promptPromise;

      if (resultText && resultText.trim()) {
        yield {
          type: AgentEventType.Text,
          content: JSON.stringify([{ kind: "text", text: resultText }]),
        };
      }
      yield finishResult(resultText);
    } finally {
      await acp.dispose();
    }
  }

  return { tag: AgentTag.ClaudeCode, run };
};
