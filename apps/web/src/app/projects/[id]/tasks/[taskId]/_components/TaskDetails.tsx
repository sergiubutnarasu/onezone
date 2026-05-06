import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import type { Task } from "@onezone/shared";
import { TaskUsageCost } from "./TaskUsageCost";

interface TaskDetailsProps {
  task: Task;
  displayInputTokens: number | null;
  displayOutputTokens: number | null;
  displayCostUsd: number | null;
}

export function TaskDetails({
  task,
  displayInputTokens,
  displayOutputTokens,
  displayCostUsd,
}: TaskDetailsProps) {
  return (
    <div>
      {task.description && (
        <div>
          <label className="px-5 pt-4 text-[11px] text-muted-foreground uppercase font-semibold tracking-wide bg-card/50 backdrop-blur-sm block">
            Details
          </label>
          <div className="px-5 pb-3 border-b border-border/60 text-sm text-muted-foreground bg-card/50 backdrop-blur-sm">
            <CollapsibleDescription value={task.description} />
          </div>
        </div>
      )}

      <TaskUsageCost
        inputTokens={displayInputTokens}
        outputTokens={displayOutputTokens}
        costUsd={displayCostUsd}
      />
    </div>
  );
}
