'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchTask, fetchMessages, fetchAgents, assignTaskAgent, deleteTask } from '@/lib/api';
import { useTaskRoom } from '@/hooks/useTaskRoom';
import { MessageType } from '@onezone/shared';
import { MessageLine } from '@/components/MessageLine';
import { CommandGroup, type CommandGroupData } from '@/components/CommandGroup';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { MessageInput } from '@/components/MessageInput';
import type { Agent } from '@onezone/shared';
import type { RoomMessage } from '@/hooks/useTaskRoom';

type ChatItem =
  | { type: 'message'; msg: RoomMessage }
  | { type: 'command'; group: CommandGroupData };

// ---------------------------------------------------------------------------
// Pure helpers for buildChatItems
// ---------------------------------------------------------------------------

function handleCommandGroup(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  const group: CommandGroupData = {
    jobId: msg.jobId,
    command: msg.command ?? msg.content,
    agentName: msg.agentName,
    startTs: msg.ts,
    lines: [],
  };
  groupMap.set(msg.jobId, group);
  items.push({ type: 'message', msg });
  items.push({ type: 'command', group });
}

function handleOutputLine(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  let group = groupMap.get(msg.jobId);
  if (!group) {
    group = {
      jobId: msg.jobId,
      command: msg.command ?? '(unknown)',
      agentName: msg.agentName,
      startTs: msg.ts,
      lines: [],
    };
    groupMap.set(msg.jobId, group);
    items.push({ type: 'command', group });
  }
  group.lines.push(msg);
}

function handleCommandExit(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  const group = groupMap.get(msg.jobId);
  const code =
    msg.exitCode ??
    parseInt(msg.content.match(/exited with code (\d+)/)?.[1] ?? '-1', 10);
  if (group) group.exitCode = code;
  items.push({
    type: 'message',
    msg: { ...msg, exitCode: code, content: msg.command ?? msg.content },
  });
}

function buildChatItems(messages: RoomMessage[]): ChatItem[] {
  const groupMap = new Map<string, CommandGroupData>();
  const items: ChatItem[] = [];

  for (const msg of messages) {
    if (msg.jobId) {
      if (msg.messageType === MessageType.CommandStart) {
        handleCommandGroup(msg, groupMap, items);
        continue;
      }
      if (msg.role === 'agent') {
        handleOutputLine(msg, groupMap, items);
        continue;
      }
      if (msg.role === 'system' && (msg.exitCode != null || msg.content.includes('exited with code'))) {
        handleCommandExit(msg, groupMap, items);
        continue;
      }
    }
    items.push({ type: 'message', msg });
  }

  return items;
}

export default function TaskChatPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTask(taskId),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string) => assignTaskAgent(taskId, agentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      router.push(`/projects/${projectId}`);
    },
  });

  function handleDelete() {
    if (confirm(`Delete task "${task?.name}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  }

  const { data: history = [] } = useQuery({
    queryKey: ['messages', taskId],
    queryFn: () => fetchMessages(taskId),
  });

  const { messages, connectedAgents, isConnected, sendMessage, prependMessages } =
    useTaskRoom(taskId, {
      onTaskDeleted: () => router.push(`/projects/${projectId}`),
    });

  // Load history into the room on mount
  useEffect(() => {
    if (history.length > 0) {
      prependMessages(history);
    }
  }, [history, prependMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-1">
          <Link href="/" className="hover:underline">Projects</Link>
          {' / '}
          <Link href={`/projects/${projectId}`} className="hover:underline">Project</Link>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-semibold">{task?.name || 'Loading...'}</h1>
          <div className="flex items-center gap-2">
            <select
              className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200"
              value={task?.agentId ?? ''}
              disabled={assignMutation.isPending}
              onChange={(e) => { if (e.target.value) assignMutation.mutate(e.target.value); }}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.isConnected ? '● ' : '○ '}
                  {a.name}
                </option>
              ))}
            </select>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isConnected
                  ? 'bg-green-900 text-green-300'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {isConnected ? 'connected' : 'disconnected'}
            </span>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 hover:bg-red-800 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Agent status */}
      <AgentStatusBar agents={connectedAgents} />

      {/* Message area */}
      <div className="flex-1 overflow-y-auto py-2">
        {chatItems.map((item, i) =>
          item.type === 'command' ? (
            <CommandGroup key={item.group.jobId} group={item.group} />
          ) : (
            <MessageLine key={item.msg.id || i} message={item.msg} />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={!isConnected} />
    </div>
  );
}
