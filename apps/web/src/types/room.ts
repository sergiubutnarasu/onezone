// apps/web/src/types/room.ts
// Web-only types for the task-room socket hook.  Kept here because they are
// shaped specifically for the React UI (flat, optional fields) rather than
// the stricter server-side discriminated union in @onezone/shared.

export interface RoomMessage {
  id?: string;
  roomId: string;
  role: "user" | "terminal" | "system";
  terminalId?: string | null;
  terminalName?: string | null;
  jobId?: string | null;
  command?: string | null;
  stream?: "stdout" | "stderr" | null;
  exitCode?: number | null;
  content: string;
  messageType?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalCostUsd?: number | null;
  agentName?: string | null;
  model?: string | null;
  ts: number;
}

export interface ConnectedTerminal {
  terminalId: string;
  terminalName: string;
  taskId: string;
}

export type Action =
  | { type: "RESET" }
  | { type: "SET_MESSAGES"; messages: RoomMessage[] }
  | { type: "APPEND_MESSAGE"; message: RoomMessage }
  | { type: "TERMINAL_CONNECTED"; info: ConnectedTerminal & { ts: number } }
  | { type: "TERMINAL_DISCONNECTED"; info: { terminalId: string; terminalName?: string; ts: number } }
  | {
      type: "COMMAND_START";
      payload: {
        terminalId: string;
        terminalName: string;
        jobId: string;
        command: string;
        agentName?: string;
        model?: string;
        ts: number;
      };
      taskId: string;
    }
  | {
      type: "COMMAND_EXIT";
      payload: {
        terminalId: string;
        jobId: string;
        command: string;
        exitCode: number;
        inputTokens?: number;
        outputTokens?: number;
        totalCostUsd?: number;
        ts: number;
      };
      taskId: string;
    };

export interface State {
  messages: RoomMessage[];
  liveMessages: RoomMessage[];
  connectedTerminals: Map<string, ConnectedTerminal>;
}
