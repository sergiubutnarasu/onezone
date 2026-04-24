'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from './CreateProjectDialog';
import type { Agent } from '@onezone/shared';

interface CreateProjectButtonProps {
  agents: Agent[];
}

export function CreateProjectButton({ agents }: CreateProjectButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        New Project
      </Button>

      <CreateProjectDialog agents={agents} open={open} onOpenChange={setOpen} />
    </>
  );
}
