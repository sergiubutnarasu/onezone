"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchTask, fetchMessages, fetchTerminals, fetchAgents } from "@/lib/api";
import { useTaskRoom } from "@/hooks/useTaskRoom";
import { TerminalStatusBar } from "@/components/TerminalStatusBar";
import { MessageInput } from "@/components/MessageInput";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskStatus, type Terminal, type Agent } from "@onezone/shared";
import { buildChatItems } from "./_lib/chat-items";
import { TaskHeader } from "./_components/TaskHeader";
import { TaskDetails } from "./_components/TaskDetails";
import { TaskChatArea } from "./_components/TaskChatArea";

export default function TaskChatPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
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

  const { messages, connectedTerminals, isConnected, sendMessage, prependMessages } =
    useTaskRoom(taskId, {
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

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  // task.inputTokens/outputTokens are set from the result message on clean session exit.
  // Fallback: sum per-turn tokens from assistant messages for interrupted sessions.
  const msgInputTokens = useMemo(
    () => messages.reduce((acc, m) => acc + (m.inputTokens ?? 0), 0),
    [messages],
  );
  const msgOutputTokens = useMemo(
    () => messages.reduce((acc, m) => acc + (m.outputTokens ?? 0), 0),
    [messages],
  );

  const displayInputTokens =
    task?.inputTokens != null ? task.inputTokens : msgInputTokens > 0 ? msgInputTokens : null;
  const displayOutputTokens =
    task?.outputTokens != null ? task.outputTokens : msgOutputTokens > 0 ? msgOutputTokens : null;
  const displayCostUsd = task?.totalCostUsd ?? null;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        <TaskHeader
          projectId={projectId}
          taskId={taskId}
          task={task}
          isConnected={isConnected}
          isTerminalActive={isTerminalActive}
          agents={agents}
          terminals={terminals}
          onDeleted={() => router.push(`/projects/${projectId}`)}
        />

        {task && (
          <TaskDetails
            task={task}
            displayInputTokens={displayInputTokens}
            displayOutputTokens={displayOutputTokens}
            displayCostUsd={displayCostUsd}
          />
        )}

        <TerminalStatusBar terminals={connectedTerminals} />

        <TaskChatArea chatItems={chatItems} />

        <MessageInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </TooltipProvider>
  );
}
