'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditProjectDialog } from './EditProjectDialog';
import type { ProjectInfo } from '@onezone/shared';

interface EditProjectButtonProps {
  project: ProjectInfo;
}

export function EditProjectButton({ project }: EditProjectButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Project settings"
        onClick={() => setOpen(true)}
      >
        <Settings className="size-4" />
      </Button>

      <EditProjectDialog
        project={project}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
