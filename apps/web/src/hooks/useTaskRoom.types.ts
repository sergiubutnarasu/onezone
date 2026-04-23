export interface RoomMessage {
  id?: string;
  roomId: string;
  role: 'user' | 'terminal' | 'system';
  terminalId?: string | null;
  terminalName?: string | null;
  jobId?: string | null;
  command?: string | null;
  stream?: 'stdout' | 'stderr' | null;
  exitCode?: number | null;
  content: string;
  messageType?: string | null;
  ts: number;
}

export interface ConnectedTerminal {
  terminalId: string;
  terminalName: string;
  taskId: string;
}

export type Action =
  | { type: 'SET_MESSAGES'; messages: RoomMessage[] }
  | { type: 'APPEND_MESSAGE'; message: RoomMessage }
  | { type: 'TERMINAL_CONNECTED'; info: ConnectedTerminal & { ts: number } }
  | { type: 'TERMINAL_DISCONNECTED'; info: { terminalId: string; terminalName?: string; ts: number } }
  | { type: 'COMMAND_START'; payload: { terminalId: string; terminalName: string; jobId: string; command: string; ts: number }; taskId: string }
  | { type: 'COMMAND_EXIT'; payload: { terminalId: string; jobId: string; command: string; exitCode: number; ts: number }; taskId: string };

export interface State {
  messages: RoomMessage[];
  connectedTerminals: Map<string, ConnectedTerminal>;
}
