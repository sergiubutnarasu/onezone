import type { AgentTag } from "@onezone/shared";

export type TaskJobConfig = {
  projectId: string;
  taskId: string;
  projectFolder: string;
  projectWorkDir: string;
};

export enum AgentEventType {
  Text = "text",
  Usage = "usage",
  Result = "result",
  Stderr = "stderr",
}

/**
 * Events emitted by an agent runner. These are the unified abstraction that
 * command-runner.ts consumes, regardless of which agent SDK produced them.
 */
export type AgentEvent =
  | { type: AgentEventType.Text; content: string }
  | { type: AgentEventType.Usage; inputTokens?: number; outputTokens?: number }
  | {
      type: AgentEventType.Result;
      content?: string;
      usage?: {
        totalCostUsd?: number;
        inputTokens?: number;
        outputTokens?: number;
      };
      nextColumnId?: string | null;
      finished?: boolean;
    }
  | { type: AgentEventType.Stderr; content: string };

/**
 * Configuration for running an agent. Each tag has its own runner
 * implementation that yields AgentEvent objects.
 */
export type AgentConfig = {
  tag: AgentTag;
  /** Run the agent with the given prompt and cwd, yielding events. */
  run: (params: AgentRunParams) => AsyncIterable<AgentEvent>;
};

export type AgentRunParams = {
  prompt: string;
  cwd: string;
  signal: AbortSignal;
};

export function parseNextColumnTag(text: string): string | null | undefined {
  const match = text.match(/\[\[ONEZONE_NEXT_COLUMN:(\S+)\]\]/);
  if (!match) return undefined;
  return match[1] === "backlog" ? null : match[1];
}
