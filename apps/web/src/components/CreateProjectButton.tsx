"use client";

import { useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { importProject } from "@/lib/api";
import type { ProjectExportConfig } from "@/types/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Agent, Terminal } from "@onezone/shared";

interface CreateProjectButtonProps {
  agents: Agent[];
  terminals: Terminal[];
}

export function CreateProjectButton({
  agents,
  terminals,
}: CreateProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const noTerminals = terminals.length === 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const router = useRouter();

  const importMutation = useMutation({
    mutationFn: (config: ProjectExportConfig) => importProject(config),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${project.id}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(
          event.target?.result as string,
        ) as ProjectExportConfig;
        importMutation.mutate(config);
      } catch {
        // ignore parse errors silently — user picked wrong file
      }
    };
    reader.readAsText(file);
    // reset so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button
              variant="outline"
              disabled={importMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload data-icon="inline-start" />
              {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
          </TooltipTrigger>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button disabled={noTerminals} onClick={() => setOpen(true)}>
              <Plus data-icon="inline-start" />
              New Project
            </Button>
          </TooltipTrigger>
          {noTerminals && (
            <TooltipContent>
              No terminals available — start one first
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      <CreateProjectDialog agents={agents} open={open} onOpenChange={setOpen} />
    </>
  );
}
