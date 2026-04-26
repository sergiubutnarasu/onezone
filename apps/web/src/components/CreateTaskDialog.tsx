"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Controller } from "react-hook-form";
import type { Terminal, Agent } from "@onezone/shared";
import type { Project } from "@/lib/api";

interface CreateTaskForm {
  name: string;
  description: string;
  terminalId: string;
  agentId: string;
  model: string;
}

interface CreateTaskDialogProps {
  projectId: string;
  project: Project | null;
  terminals: Terminal[];
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({
  projectId,
  project,
  terminals,
  agents,
  open,
  onOpenChange,
}: CreateTaskDialogProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskForm>({
    defaultValues: {
      name: "",
      description: "",
      terminalId: terminals[0]?.id ?? "",
      agentId: project?.defaultAgentId ?? "",
      model: project?.defaultModel ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        description: "",
        terminalId: terminals[0]?.id ?? "",
        agentId: project?.defaultAgentId ?? "",
        model: project?.defaultModel ?? "",
      });
    }
  }, [open, project, terminals, reset]);

  const terminalId = watch("terminalId");
  const agentId = watch("agentId");
  const model = watch("model");

  const mutation = useMutation({
    mutationFn: (data: CreateTaskForm) =>
      createTask(projectId, {
        name: data.name,
        description: data.description,
        terminalId: data.terminalId,
        agentId: data.agentId,
        model: data.model,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
      reset();
    },
  });

  const onSubmit = (data: CreateTaskForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3 pt-2"
        >
          <Input
            {...register("name", { required: "Name is required" })}
            placeholder="Task name"
            autoFocus
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}

          <Select
            value={terminalId}
            onValueChange={(v) =>
              v != null && setValue("terminalId", v, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) =>
                  v ? (
                    (terminals.find((t) => t.id === v)?.name ?? v)
                  ) : (
                    <span className="text-muted-foreground">
                      Select a terminal
                    </span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {terminals.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No terminals
                </div>
              ) : (
                terminals.map((t) => (
                  <SelectItem key={t.id} value={t.id} label={t.name}>
                    <span
                      className={`mr-1.5 ${t.isConnected ? "text-emerald-400" : "text-muted-foreground"}`}
                    >
                      {t.isConnected ? "●" : "○"}
                    </span>
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select
            value={agentId}
            onValueChange={(v) =>
              v != null && setValue("agentId", v, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) =>
                  v ? (
                    (agents.find((a) => a.id === v)?.name ?? v)
                  ) : (
                    <span className="text-muted-foreground">
                      Select an agent
                    </span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id} label={a.name}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            {...register("model", { required: "Model is required" })}
            placeholder="Model"
            value={model}
            onChange={(e) =>
              setValue("model", e.target.value, { shouldValidate: true })
            }
          />
          {errors.model && (
            <p className="text-xs text-destructive">{errors.model.message}</p>
          )}

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                placeholder="Description (optional)"
              />
            )}
          />

          <Button
            type="submit"
            disabled={
              isSubmitting ||
              mutation.isPending ||
              !terminalId ||
              !agentId ||
              !model
            }
            className="w-full mt-1"
          >
            {mutation.isPending ? "Creating…" : "Create task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
