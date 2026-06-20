// apps/server/src/types/message.ts

import type { MessageType } from "@prisma/client";

export interface CreateMessageDto {
  roomId: string;
  taskId: string;
  role: string;
  terminalId?: string;
  terminalName?: string;
  messageType: MessageType;
  jobId?: string;
  command?: string;
  exitCode?: number;
  stream?: string;
  content: string;
  agentId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCostUsd?: number;
  userId: string;
  ts: number;
}
