'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateTaskDialog } from './CreateTaskDialog';
import type { Terminal } from '@onezone/shared';

interface CreateTaskButtonProps {
  projectId: string;
  terminals: Terminal[];
}

export function CreateTaskButton({ projectId, terminals }: CreateTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const noTerminals = terminals.length === 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              disabled={noTerminals}
              onClick={() => setOpen(true)}
            />
          }
        >
          <Plus data-icon="inline-start" />
          New Task
        </TooltipTrigger>
        {noTerminals && (
          <TooltipContent>No terminals available — start one first</TooltipContent>
        )}
      </Tooltip>

      <CreateTaskDialog
        projectId={projectId}
        terminals={terminals}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
