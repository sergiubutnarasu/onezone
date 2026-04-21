import { MessageType } from '@onezone/shared';
import type { Action, RoomMessage, State } from './useTaskRoom.types';

function buildSyntheticExits(
  messages: RoomMessage[],
  agentId: string,
  agentName: string | undefined,
  ts: number,
): RoomMessage[] {
  const startedJobs = new Map<string, { command?: string | null; roomId: string }>();
  const completedJobs = new Set<string>();

  for (const msg of messages) {
    if (msg.agentId !== agentId || !msg.jobId) continue;
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
        agentId,
        agentName: agentName ?? null,
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
      return { ...state, messages: action.messages };

    case 'APPEND_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'COMMAND_START': {
      const { payload, taskId } = action;
      const msg: RoomMessage = {
        roomId: `task:${taskId}`,
        role: 'system',
        agentId: payload.agentId,
        agentName: payload.agentName,
        jobId: payload.jobId,
        command: payload.command,
        content: `[${payload.agentName}] started: ${payload.command}`,
        messageType: MessageType.CommandStart,
        ts: payload.ts,
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case 'COMMAND_EXIT': {
      const { payload, taskId } = action;
      const msg: RoomMessage = {
        roomId: `task:${taskId}`,
        role: 'system',
        agentId: payload.agentId,
        jobId: payload.jobId,
        command: payload.command,
        exitCode: payload.exitCode,
        content: payload.command,
        ts: payload.ts,
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case 'AGENT_CONNECTED': {
      const { info } = action;
      const next = new Map(state.connectedAgents);
      next.set(info.agentId, {
        agentId: info.agentId,
        agentName: info.agentName,
        taskId: info.taskId,
      });
      const noticeMsg: RoomMessage = {
        roomId: `task:${info.taskId}`,
        role: 'system',
        agentId: info.agentId,
        agentName: info.agentName,
        content: `${info.agentName} connected`,
        ts: info.ts,
      };
      return {
        connectedAgents: next,
        messages: [...state.messages, noticeMsg],
      };
    }

    case 'AGENT_DISCONNECTED': {
      const { info } = action;
      const next = new Map(state.connectedAgents);
      const agent = next.get(info.agentId);
      next.delete(info.agentId);

      const syntheticExits = buildSyntheticExits(
        state.messages,
        info.agentId,
        agent?.agentName ?? info.agentName,
        info.ts,
      );

      const noticeMsg: RoomMessage = {
        roomId: state.messages[0]?.roomId ?? '',
        role: 'system',
        agentId: info.agentId,
        agentName: agent?.agentName ?? info.agentName ?? null,
        content: `${agent?.agentName ?? info.agentName ?? info.agentId} disconnected`,
        ts: info.ts,
      };

      return {
        connectedAgents: next,
        messages: [...state.messages, ...syntheticExits, noticeMsg],
      };
    }

    default:
      return state;
  }
}

export const initialState: State = {
  messages: [],
  connectedAgents: new Map(),
};
