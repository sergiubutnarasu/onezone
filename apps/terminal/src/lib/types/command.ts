import type { Socket } from "socket.io-client";

export interface CommandRunnerDeps {
  socket: Socket;
  roomId: string;
  terminalId: string;
  terminalName: string;
  serverUrl: string;
  log: (message: string, ...args: unknown[]) => void;
  isSocketClosed: () => boolean;
}

export interface ActiveProcessEntry {
  cleanup: () => void;
}

export interface SpawnCommandProps {
  content: string;
  payload: unknown;
  deps: CommandRunnerDeps;
  activeProcesses: Map<string, ActiveProcessEntry>;
  /** When true, parses [[ONEZONE_NEXT_COLUMN:...]] and emits taskRunnerFinished. Defaults to false. */
  isTaskRunner?: boolean;
}

export interface TaskRunnerProps extends Omit<SpawnCommandProps, "content"> {}
