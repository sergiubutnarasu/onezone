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
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  createKanbanColumn,
  fetchAgents,
  fetchProject,
  updateKanbanColumn,
} from "@/lib/api";
import type { Agent } from "@onezone/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const NONE_AGENT_VALUE = "__none__";

interface KanbanColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** When provided, the dialog is in edit mode */
  column?: {
    id: string;
    name: string;
    instructions: string | null;
    agentId?: string | null;
    model?: string | null;
  };
}

interface FormValues {
  name: string;
  instructions: string;
  agentId: string; // NONE_AGENT_VALUE sentinel or a real agent UUID
  model: string;
}

export function KanbanColumnDialog({
  open,
  onOpenChange,
  projectId,
  column,
}: KanbanColumnDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!column;
  const [editorKey, setEditorKey] = useState(0);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: column?.name ?? "",
      instructions: column?.instructions ?? "",
      agentId: column?.agentId ?? NONE_AGENT_VALUE,
      model: column?.model ?? "",
    },
  });

  const selectedAgentId = watch("agentId");
  const agentSelected = selectedAgentId !== NONE_AGENT_VALUE;

  useEffect(() => {
    if (open) {
      reset({
        name: column?.name ?? "",
        instructions: column?.instructions ?? "",
        agentId: column?.agentId ?? NONE_AGENT_VALUE,
        model: column?.model ?? "",
      });
      setEditorKey((k) => k + 1);
    }
  }, [open, column, reset]);

  // When agent changes to None, clear model; when agent is selected for the first time, set project default model
  const handleAgentChange = (value: string | null) => {
    if (value === null) return;
    setValue("agentId", value, { shouldValidate: true });
    if (value === NONE_AGENT_VALUE) {
      setValue("model", "");
    } else {
      // Only set default model if model field is currently empty
      const currentModel = watch("model");
      if (!currentModel) {
        setValue("model", project?.defaultModel ?? "");
      }
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const agentId = data.agentId === NONE_AGENT_VALUE ? null : data.agentId;
      const model = agentId ? data.model || null : null;
      const name = data.name.trim();
      const instructions = data.instructions.trim();
      return isEdit
        ? updateKanbanColumn(projectId, column!.id, {
            name,
            instructions,
            agentId,
            model,
          })
        : createKanbanColumn(projectId, {
            name,
            instructions,
            agentId,
            model,
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-columns", projectId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit column" : "Add column"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form
            id="kanban-column-form"
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4 py-1"
          >
          <div className="space-y-1.5">
            <label htmlFor="col-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="col-name"
              placeholder="e.g. In Progress"
              {...register("name", {
                required: "Name is required",
                validate: (value) => {
                  const name = value.trim();
                  if (name.length === 0) return "Name is required";
                  if (["backlog", "completed"].includes(name.toLowerCase())) {
                    return "Use a workflow-specific column name";
                  }
                  return true;
                },
              })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Agent override</p>
            <p className="text-xs text-muted-foreground -mt-1">
              When set, tasks in this column will use this agent and model
              unless the task is configured to always use its own.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Agent</label>
              <Controller
                name="agentId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={handleAgentChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          v === NONE_AGENT_VALUE || !v
                            ? "None"
                            : (agents.find((a) => a.id === v)?.name ?? v)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_AGENT_VALUE}>None</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model</label>
              <Input
                {...register("model")}
                placeholder={project?.defaultModel ?? "Model"}
                disabled={!agentSelected}
              />
            </div>
          </div>
          
          <Separator />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Instructions</label>
            <Controller
              name="instructions"
              control={control}
              rules={{
                validate: (value) =>
                  value.trim().length > 0 || "Instructions are required",
              }}
              render={({ field }) => (
                <RichTextEditor
                  key={editorKey}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Define instruction for this column"
                />
              )}
            />
            {errors.instructions && (
              <p className="text-xs text-destructive">{errors.instructions.message}</p>
            )}
          </div>

          </form>
        </DialogBody>
        <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="kanban-column-form" disabled={isSubmitting || mutation.isPending}>
              {isEdit ? "Save" : "Add column"}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
