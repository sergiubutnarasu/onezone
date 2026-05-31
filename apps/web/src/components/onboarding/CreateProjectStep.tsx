"use client";

import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/ProjectForm";
import type { Agent } from "@/lib/api";

interface CreateProjectStepProps {
  agents: Agent[];
}

const FORM_ID = "onboarding-project-form";

export function CreateProjectStep({ agents }: CreateProjectStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Create your first project</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Projects group your tasks. Give it a name and pick a default agent.
        </p>
      </div>

      <ProjectForm
        agents={agents}
        formId={FORM_ID}
        renderFooter={({ isSubmitting }) => (
          <div className="flex justify-end pt-2 border-t border-border/50">
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </div>
        )}
      />
    </div>
  );
}
