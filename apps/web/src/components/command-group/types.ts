"use client";

import type { RoomMessage } from "@/types/room";

export interface CommandGroupData {
  jobId: string;
  command: string;
  terminalName?: string | null;
  agentName?: string | null;
  model?: string | null;
  startTs: number;
  exitCode?: number;
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
  block: import("@/lib/agent-content").ContentBlock;
}
