'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateTaskDialog } from './CreateTaskDialog';
import type { Terminal, Agent, ProjectInfo } from '@onezone/shared';

interface CreateTaskButtonProps {
  projectId: string;
  project: ProjectInfo | null;
  terminals: Terminal[];
  agents: Agent[];
  iconOnly?: boolean;
}

export function CreateTaskButton({ projectId, project, terminals, agents, iconOnly }: CreateTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const noTerminals = terminals.length === 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            disabled={noTerminals}
            onClick={() => setOpen(true)}
            size={iconOnly ? 'icon' : 'default'}
            variant={iconOnly ? 'ghost' : 'default'}
          >
            <Plus className={iconOnly ? 'size-4' : undefined} data-icon={iconOnly ? undefined : 'inline-start'} />
            {!iconOnly && 'New Task'}
          </Button>
        </TooltipTrigger>
        {noTerminals && (
          <TooltipContent>No terminals available — start one first</TooltipContent>
        )}
      </Tooltip>

      <CreateTaskDialog
        projectId={projectId}
        project={project}
        terminals={terminals}
        agents={agents}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
