import type { CommandGroupData } from "./types";
import { MetadataGrid } from "./MetadataGrid";

export function CommandGroupMetadata({ group }: { group: CommandGroupData }) {
  return (
    <div className="border-b border-border/30 px-3 pb-2">
      <MetadataGrid
        entries={[
          ["jobId", group.jobId],
          ["roomId", group.roomId],
          ["terminalId", group.terminalId],
          ["terminal", group.terminalName],
          ["agent", group.agentName],
          ["model", group.model],
          ["started", new Date(group.startTs).toLocaleString()],
          ["ended", group.endTs ? new Date(group.endTs).toLocaleString() : undefined],
          ["exitCode", group.exitCode],
          ["inputTokens", group.inputTokens],
          ["outputTokens", group.outputTokens],
          ["totalCostUsd", group.totalCostUsd],
        ]}
      />
    </div>
  );
}