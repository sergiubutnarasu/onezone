"use client";

import { Hash, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import { TaskUsageCost } from "./TaskUsageCost";
import { TaskChatArea } from "./TaskChatArea";
import { MessageInput } from "@/components/MessageInput";
import { TerminalStatusBar } from "@/components/TerminalStatusBar";
import type { Task } from "@onezone/shared";
import type { ChatItem } from "../_lib/chat-items";
import type { ConnectedTerminal } from "@/hooks/useTaskRoom";

interface TaskMainContentProps {
  task: Task | undefined;
  taskId: string;
  displayInputTokens: number | null;
  displayOutputTokens: number | null;
  displayCostUsd: number | null;
  chatItems: ChatItem[];
  connectedTerminals: ConnectedTerminal[];
  isConnected: boolean;
  isTerminalConnected: boolean;
  onStop: (jobId: string) => void;
  onSend: (content: string) => void;
  onToggleSidebar: () => void;
  onToggleInfoPanel: () => void;
}

export function TaskMainContent({
  task,
  taskId,
  displayInputTokens,
  displayOutputTokens,
  displayCostUsd,
  chatItems,
  connectedTerminals,
  isConnected,
  isTerminalConnected,
  onStop,
  onSend,
  onToggleSidebar,
  onToggleInfoPanel,
}: TaskMainContentProps) {
  const isCompleted = !!task?.completedAt;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Task header info */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle task sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
            <h1 className="text-lg font-semibold tracking-tight flex-1 min-w-0">
              {task?.name ?? "Loading…"}
            </h1>
            <button
              onClick={onToggleInfoPanel}
              className="xl:hidden text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle task info"
            >
              <PanelRightOpen className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Hash className="size-3 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/60 font-mono">
              {taskId}
            </span>
            <CopyButton value={taskId} />
          </div>
        </div>

        {task?.description && (
          <div className="px-5 pb-3 text-sm text-muted-foreground">
            <CollapsibleDescription value={task.description} />
          </div>
        )}

        <TaskUsageCost
          inputTokens={displayInputTokens}
          outputTokens={displayOutputTokens}
          costUsd={displayCostUsd}
        />
      </div>

      <TerminalStatusBar terminals={connectedTerminals} />

      <TaskChatArea chatItems={chatItems} onStop={onStop} />

      {!isCompleted && (
        <MessageInput
          onSend={onSend}
          disabled={!isConnected || !isTerminalConnected}
          disabledPlaceholder={
            isConnected ? 'Terminal disconnected' : 'Connecting…'
          }
        />
      )}
    </div>
  );
}
