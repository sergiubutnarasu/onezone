'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EditTaskDialog } from './EditTaskDialog';
import type { Task } from '@onezone/shared';

interface EditTaskButtonProps {
  task: Task;
  projectId: string;
}

export function EditTaskButton({ task, projectId }: EditTaskButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            />
          }
        >
          <Pencil />
        </TooltipTrigger>
        <TooltipContent>Edit task</TooltipContent>
      </Tooltip>

      <EditTaskDialog
        task={task}
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
