import { MessageType } from '@onezone/shared';
import type { Action, RoomMessage, State } from './useTaskRoom.types';

function buildSyntheticExits(
  messages: RoomMessage[],
  terminalId: string,
  terminalName: string | undefined,
  ts: number,
): RoomMessage[] {
  const startedJobs = new Map<string, { command?: string | null; roomId: string }>();
  const completedJobs = new Set<string>();

  for (const msg of messages) {
    if (msg.terminalId !== terminalId || !msg.jobId) continue;
    if (msg.messageType === MessageType.CommandStart) {
      startedJobs.set(msg.jobId, { command: msg.command, roomId: msg.roomId });
    }
    if (msg.exitCode != null || msg.messageType === MessageType.CommandExit) {
      completedJobs.add(msg.jobId);
    }
  }

  const exits: RoomMessage[] = [];
  for (const [jobId, { command, roomId }] of startedJobs) {
    if (!completedJobs.has(jobId)) {
      exits.push({
        roomId,
        role: 'system',
        terminalId,
        terminalName: terminalName ?? null,
        jobId,
        command,
        exitCode: -1,
        content: command ?? jobId,
        ts,
      });
    }
  }
  return exits;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages, liveMessages: [] };

    case 'APPEND_MESSAGE': {
      const messages = [...state.messages, action.message].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
      return {
        ...state,
        messages,
        liveMessages: [...state.liveMessages, action.message],
      };
    }

    case 'COMMAND_START': {
      const { payload, taskId } = action;
      const msg: RoomMessage = {
        roomId: `task:${taskId}`,
        role: 'system',
        terminalId: payload.terminalId,
        terminalName: payload.terminalName,
        jobId: payload.jobId,
        command: payload.command,
        content: `[${payload.terminalName}] started: ${payload.command}`,
        messageType: MessageType.CommandStart,
        agentName: payload.agentName ?? null,
        model: payload.model ?? null,
        ts: payload.ts,
      };
      return { ...state, messages: [...state.messages, msg], liveMessages: [...state.liveMessages, msg] };
    }

    case 'COMMAND_EXIT': {
      const { payload, taskId } = action;
      const terminalName = state.connectedTerminals.get(payload.terminalId)?.terminalName ?? null;
      const msg: RoomMessage = {
        roomId: `task:${taskId}`,
        role: 'system',
        terminalId: payload.terminalId,
        terminalName,
        jobId: payload.jobId,
        command: payload.command,
        exitCode: payload.exitCode,
        content: payload.command,
        inputTokens: payload.inputTokens ?? null,
        outputTokens: payload.outputTokens ?? null,
        totalCostUsd: payload.totalCostUsd ?? null,
        ts: payload.ts,
      };
      return { ...state, messages: [...state.messages, msg], liveMessages: [...state.liveMessages, msg] };
    }

    case 'TERMINAL_CONNECTED': {
      const { info } = action;
      const next = new Map(state.connectedTerminals);
      next.set(info.terminalId, {
        terminalId: info.terminalId,
        terminalName: info.terminalName,
        taskId: info.taskId,
      });
      const noticeMsg: RoomMessage = {
        roomId: `task:${info.taskId}`,
        role: 'system',
        terminalId: info.terminalId,
        terminalName: info.terminalName,
        content: `${info.terminalName} connected`,
        ts: info.ts,
      };
      return {
        connectedTerminals: next,
        messages: [...state.messages, noticeMsg],
        liveMessages: [...state.liveMessages, noticeMsg],
      };
    }

    case 'TERMINAL_DISCONNECTED': {
      const { info } = action;
      const next = new Map(state.connectedTerminals);
      const terminal = next.get(info.terminalId);
      next.delete(info.terminalId);

      const syntheticExits = buildSyntheticExits(
        state.messages,
        info.terminalId,
        terminal?.terminalName ?? info.terminalName,
        info.ts,
      );

      const noticeMsg: RoomMessage = {
        roomId: state.messages[0]?.roomId ?? '',
        role: 'system',
        terminalId: info.terminalId,
        terminalName: terminal?.terminalName ?? info.terminalName ?? null,
        content: `${terminal?.terminalName ?? info.terminalName ?? info.terminalId} disconnected`,
        ts: info.ts,
      };

      return {
        connectedTerminals: next,
        messages: [...state.messages, ...syntheticExits, noticeMsg],
        liveMessages: [...state.liveMessages, ...syntheticExits, noticeMsg],
      };
    }

    default:
      return state;
  }
}

export const initialState: State = {
  messages: [],
  liveMessages: [],
  connectedTerminals: new Map(),
};
