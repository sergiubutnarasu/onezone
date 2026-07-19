"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SchedulesDialog } from "@/components/SchedulesDialog";
import type {
  Agent,
  KanbanColumn,
  ProjectInfo,
  Terminal,
} from "@onezone/shared";
import { CalendarClock } from "lucide-react";

interface Props {
  projectId: string;
  project: ProjectInfo | null;
  terminals: Terminal[];
  agents: Agent[];
  columns: KanbanColumn[];
  iconOnly?: boolean;
}

export function SchedulesButton({
  projectId,
  project,
  terminals,
  agents,
  columns,
  iconOnly,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size={iconOnly ? "icon" : "default"}
        onClick={() => setOpen(true)}
        title="Manage task schedules"
        aria-label={iconOnly ? "Manage task schedules" : undefined}
      >
        <CalendarClock className={iconOnly ? "size-4" : "size-4 mr-1"} />
        {!iconOnly && "Schedules"}
      </Button>
      <SchedulesDialog
        projectId={projectId}
        project={project}
        terminals={terminals}
        agents={agents}
        columns={columns}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
