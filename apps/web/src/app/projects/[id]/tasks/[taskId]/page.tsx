'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchTask, fetchMessages } from '@/lib/api';
import { useTaskRoom } from '@/hooks/useTaskRoom';
import { MessageLine } from '@/components/MessageLine';
import { CommandGroup, type CommandGroupData } from '@/components/CommandGroup';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { MessageInput } from '@/components/MessageInput';
import type { RoomMessage } from '@/hooks/useTaskRoom';

type ChatItem =
  | { type: 'message'; msg: RoomMessage }
  | { type: 'command'; group: CommandGroupData };

function buildChatItems(messages: RoomMessage[]): ChatItem[] {
  const groupMap = new Map<string, CommandGroupData>();
  const items: ChatItem[] = [];

  for (const msg of messages) {
    if (msg.jobId) {
      // system start message → show as timeline event + create group
      if (msg.role === 'system' && msg.content.includes('started:')) {
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
        continue;
      }
      // output line → append to existing group (or create one if start was missed)
      if (msg.role === 'agent') {
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
        continue;
      }
      // system exit message → mark group done + show as timeline event
      if (msg.role === 'system' && (msg.exitCode != null || msg.content.includes('exited with code'))) {
        const group = groupMap.get(msg.jobId);
        const code = msg.exitCode ?? parseInt(msg.content.match(/exited with code (\d+)/)?.[1] ?? '-1', 10);
        if (group) group.exitCode = code;
        // normalise content: DB stores verbose string, socket stores raw command
        items.push({ type: 'message', msg: { ...msg, exitCode: code, content: msg.command ?? msg.content } });
        continue;
      }
    }
    // ungrouped message (user chat, system without jobId)
    items.push({ type: 'message', msg });
  }

  return items;
}

export default function TaskChatPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTask(taskId),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['messages', taskId],
    queryFn: () => fetchMessages(taskId),
  });

  const { messages, connectedAgents, isConnected, sendMessage, prependMessages } =
    useTaskRoom(taskId);

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
        <div className="flex items-center justify-between">
          <h1 className="font-semibold">{task?.name || 'Loading...'}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isConnected
                ? 'bg-green-900 text-green-300'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {isConnected ? 'connected' : 'disconnected'}
          </span>
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
