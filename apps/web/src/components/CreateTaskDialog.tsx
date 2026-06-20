"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Terminal, Agent, ProjectInfo } from "@onezone/shared";

interface CreateTaskForm {
  name: string;
  description: string;
  terminalId: string;
  agentId: string;
  model: string;
  useTaskAgentAndModel: boolean;
}

interface CreateTaskDialogProps {
  projectId: string;
  project: ProjectInfo | null;
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
  const router = useRouter();

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
      useTaskAgentAndModel: false,
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
        useTaskAgentAndModel: false,
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
        useTaskAgentAndModel: data.useTaskAgentAndModel,
      }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
      reset();
      router.push(`/projects/${projectId}/tasks/${task.id}`);
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
        <DialogBody>
          <form
            id="create-task-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3 py-1"
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

          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                Always use task agent &amp; model
              </p>
              <p className="text-xs text-muted-foreground">
                Override the column&apos;s agent and model with this
                task&apos;s own settings.
              </p>
            </div>
            <Controller
              name="useTaskAgentAndModel"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

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
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="submit"
            form="create-task-form"
            disabled={
              isSubmitting ||
              mutation.isPending ||
              !terminalId ||
              !agentId ||
              !model
            }
          >
            {mutation.isPending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
