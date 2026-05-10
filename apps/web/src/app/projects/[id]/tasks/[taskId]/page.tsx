"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchTask, fetchMessages, fetchTerminals, fetchAgents, fetchKanbanColumns } from "@/lib/api";
import { useTaskRoom } from "@/hooks/useTaskRoom";
import { TerminalStatusBar } from "@/components/TerminalStatusBar";
import { MessageInput } from "@/components/MessageInput";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type Terminal, type Agent, type KanbanColumn } from "@onezone/shared";
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

  const { data: columns = [] } = useQuery<KanbanColumn[]>({
    queryKey: ["kanban-columns", projectId],
    queryFn: () => fetchKanbanColumns(projectId),
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
    task.columnId !== null &&
    !task.completedAt;

  // Load history into the room on mount
  useEffect(() => {
    if (history.length > 0) {
      prependMessages(history);
    }
  }, [history, prependMessages]);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  // Sum token/cost from all COMMAND_EXIT messages (history + live).
  // Each COMMAND_EXIT represents one completed agent run and carries the final per-run totals.
  const { displayInputTokens, displayOutputTokens, displayCostUsd } = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    for (const m of messages) {
      if (m.messageType === 'COMMAND_EXIT' || (m.exitCode != null && m.jobId)) {
        inputTokens += m.inputTokens ?? 0;
        outputTokens += m.outputTokens ?? 0;
        costUsd += m.totalCostUsd ?? 0;
      }
    }
    return {
      displayInputTokens: inputTokens > 0 ? inputTokens : null,
      displayOutputTokens: outputTokens > 0 ? outputTokens : null,
      displayCostUsd: costUsd > 0 ? costUsd : null,
    };
  }, [messages]);

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
          columns={columns}
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
