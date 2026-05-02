"use client";

import { useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Home, ChevronRight, Wifi, WifiOff, Bot, Cpu, Loader2 } from "lucide-react";
import {
  fetchTask,
  fetchMessages,
  fetchTerminals,
  fetchAgents,
} from "@/lib/api";
import { useTaskRoom } from "@/hooks/useTaskRoom";
import { MessageType } from "@onezone/shared";
import { MessageLine } from "@/components/MessageLine";
import { CommandGroup, type CommandGroupData } from "@/components/CommandGroup";
import { TerminalStatusBar } from "@/components/TerminalStatusBar";
import { MessageInput } from "@/components/MessageInput";
import { CopyButton } from "@/components/CopyButton";
import { TaskMoreMenu } from "@/components/TaskMoreMenu";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CollapsibleDescription } from '@/components/CollapsibleDescription';
import { TASK_STATUS_LABELS, TaskStatus, type Terminal, type Agent } from "@onezone/shared";
import type { RoomMessage } from "@/hooks/useTaskRoom";

type ChatItem =
  | { type: "message"; msg: RoomMessage }
  | { type: "command"; group: CommandGroupData };

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
  items.push({ type: "message", msg });
  items.push({ type: "command", group });
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
      command: msg.command ?? "(unknown)",
      terminalName: msg.terminalName,
      startTs: msg.ts,
      lines: [],
    };
    groupMap.set(msg.jobId, group);
    items.push({ type: "command", group });
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
    parseInt(msg.content.match(/exited with code (\d+)/)?.[1] ?? "-1", 10);
  if (group) group.exitCode = code;
  items.push({
    type: "message",
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
      if (msg.role === "terminal") {
        handleOutputLine(msg, groupMap, items);
        continue;
      }
      if (
        msg.role === "system" &&
        (msg.exitCode != null || msg.content.includes("exited with code"))
      ) {
        handleCommandExit(msg, groupMap, items);
        continue;
      }
    }
    items.push({ type: "message", msg });
  }

  return items;
}

export default function TaskChatPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => fetchTask(taskId),
  });

  const { data: terminals = [] } = useQuery<Terminal[]>({
    queryKey: ["terminals"],
    queryFn: fetchTerminals,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["messages", taskId],
    queryFn: () => fetchMessages(taskId),
  });

  const {
    messages,
    connectedTerminals,
    isConnected,
    sendMessage,
    prependMessages,
  } = useTaskRoom(taskId, {
    onTaskDeleted: () => router.push(`/projects/${projectId}`),
  });

  const isTerminalActive =
    connectedTerminals.length > 0 &&
    !!task &&
    task.status !== TaskStatus.BACKLOG &&
    task.status !== TaskStatus.DONE;

  // Load history into the room on mount
  useEffect(() => {
    if (history.length > 0) {
      prependMessages(history);
    }
  }, [history, prependMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatItems.length > 0) {
      virtualizer.scrollToIndex(chatItems.length - 1, { behavior: "smooth" });
    }
  }, [messages]);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  const virtualizer = useVirtualizer({
    count: chatItems.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (i) => {
      const item = chatItems[i];
      if (item.type === "command") return 40 + item.group.lines.length * 18;
      return 24;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 10,
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60 bg-card/50 backdrop-blur-sm">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3" />
              Projects
            </Link>
            <ChevronRight className="size-3" />
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-foreground transition-colors"
            >
              Project
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground truncate max-w-50">
              {task?.name ?? "Loading…"}
            </span>
          </div>

          {/* Main header content */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: Title + metadata */}
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold tracking-tight truncate">
                {task?.name ?? "Loading…"}
              </h1>

              {!task && (
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[11px] text-muted-foreground/50 font-mono">
                    {taskId.slice(0, 8)}
                  </span>
                  <CopyButton value={taskId} />
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Connection badge */}
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={
                  isConnected
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 h-7"
                    : "text-muted-foreground h-7"
                }
              >
                {isConnected ? (
                  <Wifi className="size-3 mr-1" />
                ) : (
                  <WifiOff className="size-3 mr-1" />
                )}
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>

              {/* Actions dropdown */}
              {task && (
                <TaskMoreMenu
                  task={task}
                  projectId={projectId}
                  agents={agents}
                  terminals={terminals}
                  onDeleted={() => router.push(`/projects/${projectId}`)}
                />
              )}
            </div>
          </div>

          <div>
            {/* ID chip */}
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 font-mono">
              {taskId}
              <CopyButton value={taskId} />
            </span>
          </div>

          {task && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Status chip */}
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  task.status === "DONE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : task.status === "IN_PROGRESS"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : task.status === "IN_REVIEW"
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : task.status === "TESTING"
                          ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                          : task.status === "PLANNING"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {isTerminalActive ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span
                    className={`size-1.5 rounded-full ${
                      task.status === "DONE"
                        ? "bg-emerald-400"
                        : task.status === "IN_PROGRESS"
                          ? "bg-amber-400"
                          : task.status === "IN_REVIEW"
                            ? "bg-sky-400"
                            : task.status === "TESTING"
                              ? "bg-violet-400"
                              : task.status === "PLANNING"
                                ? "bg-blue-400"
                                : "bg-muted-foreground"
                    }`}
                  />
                )}
                {TASK_STATUS_LABELS[task.status]}
              </span>

              {/* Terminal chip */}
              {task.terminal ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    task.terminal.isConnected
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${task.terminal.isConnected ? "bg-emerald-400" : "bg-muted-foreground"}`}
                  />
                  {task.terminal.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-destructive/10 text-destructive border-destructive/20">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  No terminal
                </span>
              )}

              {/* Agent chip */}
              {task.agent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                  <Bot className="size-3" />
                  {task.agent.name}
                </span>
              )}

              {/* Model chip */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border">
                <Cpu className="size-3" />
                {task.model}
              </span>
            </div>
          )}
        </div>

        <div>
          {task?.description && (
            <div>
              <label className="px-5 pt-4 text-[11px] text-muted-foreground uppercase font-semibold tracking-wide bg-card/50 backdrop-blur-sm block">
                Details
              </label>
              <div className="px-5 pb-3 border-b border-border/60 text-sm text-muted-foreground bg-card/50 backdrop-blur-sm">
                <CollapsibleDescription value={task.description} />
              </div>
            </div>
          )}
        </div>

        {/* Terminal status bar */}
        <TerminalStatusBar terminals={connectedTerminals} />

        {/* Message area */}
        <div ref={scrollParentRef} className="flex-1 min-h-0 overflow-y-auto chat-scroll">
          <div
            className="relative py-2 pb-4 font-mono text-sm"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = chatItems[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {item.type === "command" ? (
                    <CommandGroup group={item.group} />
                  ) : (
                    <MessageLine message={item.msg} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <MessageInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </TooltipProvider>
  );
}
