"use client";

import type { ContentBlock } from "@/lib/agent-content";
import type { RoomMessage } from "@/types/room";

export interface CommandGroupData {
  jobId: string;
  roomId?: string | null;
  command: string;
  terminalId?: string | null;
  terminalName?: string | null;
  agentName?: string | null;
  model?: string | null;
  startTs: number;
  endTs?: number;
  exitCode?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalCostUsd?: number | null;
  lines: RoomMessage[];
}

export type GroupedLine =
  | { kind: "setup"; lines: RoomMessage[] }
  | { kind: "output"; msg: RoomMessage };

export interface CommandGroupProps {
  group: CommandGroupData;
  onStop?: (jobId: string) => void;
}

export interface ExpandableProps {
  expandSignal: number;
  expandDirection: boolean;
}

export interface SetupLogBlockProps extends ExpandableProps {
  lines: RoomMessage[];
}

export interface AgentOutputLineProps extends ExpandableProps {
  content: string;
}

export interface ContentBlockViewProps extends ExpandableProps {
  block: ContentBlock;
}

export interface FileOperationBlockData {
  kind: "file_operation";
  operation: "read" | "write" | "edit";
  filePath?: string;
  title: string;
  details: string[];
  props?: Record<string, unknown>;
  preview?: string;
  diff?: string;
}

export interface SkillOperationBlockData {
  kind: "skill_operation";
  title: string;
  skillName?: string;
  source?: string;
  mode?: string;
  command?: string;
  details: string[];
  args?: Record<string, unknown>;
  props?: Record<string, unknown>;
}

export interface CommandOperationBlockData {
  kind: "command_operation";
  command: string;
  title?: string;
  props: Record<string, unknown>;
}

export type ToolDisplayBlock =
  | Extract<ContentBlock, { kind: "command" | "diff" }>
  | CommandOperationBlockData
  | FileOperationBlockData
  | SkillOperationBlockData;
