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
import type { Agent } from "@onezone/shared";

interface CreateProjectDialogProps {
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORM_ID = "create-project-form";

export function CreateProjectDialog({
  agents,
  open,
  onOpenChange,
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
            formId={FORM_ID}
            resetSignal={open}
            onSuccess={() => onOpenChange(false)}
            renderFooter={({ isSubmitting }) => (
              <DialogFooter>
                <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create project"}
                </Button>
              </DialogFooter>
            )}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
