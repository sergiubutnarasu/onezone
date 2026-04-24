'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Home, ChevronRight, Trash2, Wifi, WifiOff } from 'lucide-react';
import { fetchTask, fetchMessages, fetchTerminals, assignTaskTerminal, deleteTask, updateTaskStatus } from '@/lib/api';
import { useTaskRoom } from '@/hooks/useTaskRoom';
import { MessageType } from '@onezone/shared';
import { MessageLine } from '@/components/MessageLine';
import { CommandGroup, type CommandGroupData } from '@/components/CommandGroup';
import { TerminalStatusBar } from '@/components/TerminalStatusBar';
import { MessageInput } from '@/components/MessageInput';
import { CopyButton } from '@/components/CopyButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLUMNS, type Terminal } from '@onezone/shared';
import { EditTaskButton } from '@/components/EditTaskButton';
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
    terminalName: msg.terminalName,
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
      terminalName: msg.terminalName,
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
      if (msg.role === 'terminal') {
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

  const { data: terminals = [] } = useQuery<Terminal[]>({
    queryKey: ['terminals'],
    queryFn: fetchTerminals,
  });

  const assignMutation = useMutation({
    mutationFn: (terminalId: string) => assignTaskTerminal(taskId, terminalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(taskId, status),
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

  const { messages, connectedTerminals, isConnected, sendMessage, prependMessages } =
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
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">{task?.name ?? 'Loading…'}</h1>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground font-mono">{taskId}</p>
                <CopyButton value={taskId} />
              </div>
            </div>

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

              {/* Status selector */}
              <Select
                value={task?.status ?? ''}
                disabled={statusMutation.isPending}
                onValueChange={(v) => { if (v) statusMutation.mutate(v as TaskStatus); }}
              >
                <SelectTrigger className="h-7 text-xs w-32 bg-muted/50">
                  <SelectValue placeholder="Status…">
                    {(v: string) => TASK_STATUS_LABELS[v as TaskStatus] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_COLUMNS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Terminal selector */}
              <Select
                value={task?.terminalId ?? ''}
                disabled={assignMutation.isPending}
                onValueChange={(v) => { if (v != null) assignMutation.mutate(v); }}
              >
                <SelectTrigger className="h-7 text-xs w-36 bg-muted/50">
                  <SelectValue placeholder="Terminal…">
                    {(v: string) => terminals.find((t) => t.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {terminals.map((t) => (
                    <SelectItem key={t.id} value={t.id} label={t.name} className="text-xs">
                      <span className={`mr-1.5 ${t.isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {t.isConnected ? '●' : '○'}
                      </span>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Edit */}
              {task && <EditTaskButton task={task} projectId={projectId} />}

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

        {/* Terminal status bar */}
        <TerminalStatusBar terminals={connectedTerminals} />

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
