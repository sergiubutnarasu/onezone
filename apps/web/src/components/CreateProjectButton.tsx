'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateProjectDialog } from './CreateProjectDialog';
import type { Agent, Terminal } from '@onezone/shared';

interface CreateProjectButtonProps {
  agents: Agent[];
  terminals: Terminal[];
}

export function CreateProjectButton({ agents, terminals }: CreateProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const noTerminals = terminals.length === 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            disabled={noTerminals}
            onClick={() => setOpen(true)}
          >
            <Plus data-icon="inline-start" />
            New Project
          </Button>
        </TooltipTrigger>
        {noTerminals && (
          <TooltipContent>No terminals available — start one first</TooltipContent>
        )}
      </Tooltip>

      <CreateProjectDialog agents={agents} open={open} onOpenChange={setOpen} />
    </>
  );
}
