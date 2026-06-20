import type { TaskDetails } from "@onezone/shared";

export interface LobbyConnectionDeps {
  serverUrl: string;
  terminalId: string;
  terminalName: string;
  activeTaskIds: Set<string>;
  onTaskAssigned: (task: TaskDetails) => Promise<void>;
  log: (message: string, ...args: unknown[]) => void;
}

export interface TaskConnectionDeps {
  serverUrl: string;
  task: TaskDetails;
  terminalId: string;
  terminalName: string;
  activeTaskIds: Set<string>;
  log: (message: string, ...args: unknown[]) => void;
}
