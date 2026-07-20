"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectForm } from "./ProjectForm";
import type { Agent, Terminal } from "@onezone/shared";

interface CreateProjectDialogProps {
  agents: Agent[];
  terminals: Terminal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectBuilderStarted?: (pending: {
    name: string;
    terminalName?: string;
  }) => void;
}

const FORM_ID = "create-project-form";

export function CreateProjectDialog({
  agents,
  terminals,
  open,
  onOpenChange,
  onProjectBuilderStarted,
}: CreateProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ProjectForm
            agents={agents}
            terminals={terminals}
            enableBoardGeneration
            formId={FORM_ID}
            resetSignal={open}
            onSuccess={() => onOpenChange(false)}
            onProjectBuilderStarted={onProjectBuilderStarted}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="submit" form={FORM_ID}>
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
