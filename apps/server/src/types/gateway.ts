// apps/server/src/types/gateway.ts

import type { MessageStream } from "@onezone/shared";

export interface ChatMessageData {
  roomId: string;
  content: string;
}

export interface OutputLineData {
  roomId: string;
  terminalId?: string;
  terminalName?: string;
  jobId?: string;
  command?: string;
  stream: MessageStream;
  content: string;
  ts?: number;
  agentId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface CommandStartData {
  roomId: string;
  terminalId?: string;
  terminalName?: string;
  jobId: string;
  command: string;
  agentId?: string;
  agentName?: string;
  model?: string;
}

export interface CommandExitData {
  roomId: string;
  terminalId?: string;
  terminalName?: string;
  jobId: string;
  command: string;
  exitCode: number;
  ts?: number;
  agentId?: string;
  model?: string;
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  taskRunnerFinished?: boolean;
  nextColumnId?: string | null;
}
