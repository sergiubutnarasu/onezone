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
}

export function SchedulesButton({
  projectId,
  project,
  terminals,
  agents,
  columns,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        title="Manage task schedules"
      >
        <CalendarClock className="size-4 mr-1" />
        Schedules
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
