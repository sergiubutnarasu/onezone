'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Home, ChevronRight, Trash2, Wifi, WifiOff } from 'lucide-react';
import { fetchTask, fetchMessages, fetchAgents, assignTaskAgent, deleteTask } from '@/lib/api';
import { useTaskRoom } from '@/hooks/useTaskRoom';
import { MessageType } from '@onezone/shared';
import { MessageLine } from '@/components/MessageLine';
import { CommandGroup, type CommandGroupData } from '@/components/CommandGroup';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { MessageInput } from '@/components/MessageInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
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
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/60 bg-card/50 backdrop-blur-sm">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="size-3" />
              Projects
            </Link>
            <ChevronRight className="size-3" />
            <Link href={`/projects/${projectId}`} className="hover:text-foreground transition-colors">
              Project
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground truncate max-w-50">{task?.name ?? 'Loading…'}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h1 className="font-semibold text-sm truncate">{task?.name ?? 'Loading…'}</h1>

            <div className="flex items-center gap-2 shrink-0">
              {/* Connection badge */}
              <Badge
                variant={isConnected ? 'default' : 'secondary'}
                className={isConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                  : 'text-muted-foreground'
                }
              >
                {isConnected
                  ? <Wifi className="size-3 mr-1" />
                  : <WifiOff className="size-3 mr-1" />
                }
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>

              {/* Agent selector */}
              <Select
                value={task?.agentId ?? ''}
                disabled={assignMutation.isPending}
                onValueChange={(v) => { if (v != null) assignMutation.mutate(v); }}
              >
                <SelectTrigger className="h-7 text-xs w-36 bg-muted/50">
                  <SelectValue placeholder="Agent…">
                    {(v: string) => agents.find((a) => a.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id} label={a.name} className="text-xs">
                      <span className={`mr-1.5 ${a.isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {a.isConnected ? '●' : '○'}
                      </span>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delete */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    />
                  }
                >
                  <Trash2 />
                </TooltipTrigger>
                <TooltipContent>Delete task</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Agent status bar */}
        <AgentStatusBar agents={connectedAgents} />

        {/* Message area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="py-2 pb-4 font-mono text-sm">
            {chatItems.map((item, i) =>
              item.type === 'command' ? (
                <CommandGroup key={item.group.jobId} group={item.group} />
              ) : (
                <MessageLine key={item.msg.id || i} message={item.msg} />
              ),
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <MessageInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </TooltipProvider>
  );
}
