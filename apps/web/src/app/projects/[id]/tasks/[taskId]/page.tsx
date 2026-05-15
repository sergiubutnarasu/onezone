"use client";

import { MessageInput } from "@/components/MessageInput";
import { TerminalStatusBar } from "@/components/TerminalStatusBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTaskRoom } from "@/hooks/useTaskRoom";
import {
  fetchAgents,
  fetchKanbanColumns,
  fetchMessages,
  fetchTask,
  fetchTerminals,
} from "@/lib/api";
import { type Agent, type KanbanColumn, type Terminal } from "@onezone/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { TaskChatArea } from "./_components/TaskChatArea";
import { TaskDetails } from "./_components/TaskDetails";
import { TaskHeader } from "./_components/TaskHeader";
import { buildChatItems } from "./_lib/chat-items";

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

  const {
    messages,
    connectedTerminals,
    isConnected,
    sendMessage,
    stopCommand,
    prependMessages,
  } = useTaskRoom(taskId, {
    onTaskDeleted: () => router.push(`/projects/${projectId}`),
  });

  // Load history into the room on mount
  useEffect(() => {
    if (history.length > 0) {
      prependMessages(history);
    }
  }, [history, prependMessages]);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  const isTerminalActive = useMemo(
    () =>
      chatItems.some(
        (item) => item.type === "command" && item.group.exitCode === undefined,
      ),
    [chatItems],
  );

  // Sum token/cost from all COMMAND_EXIT messages (history + live).
  // Each COMMAND_EXIT represents one completed agent run and carries the final per-run totals.
  const { displayInputTokens, displayOutputTokens, displayCostUsd } =
    useMemo(() => {
      let inputTokens = 0;
      let outputTokens = 0;
      let costUsd = 0;
      for (const m of messages) {
        if (
          m.messageType === "COMMAND_EXIT" ||
          (m.exitCode != null && m.jobId)
        ) {
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

        <TaskChatArea chatItems={chatItems} onStop={stopCommand} />

        <MessageInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </TooltipProvider>
  );
}
