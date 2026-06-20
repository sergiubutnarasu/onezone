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
import { Switch } from "@/components/ui/switch";
import { updateTask } from "@/lib/api";
import {
  BACKLOG_COLUMN_ID,
  type Agent,
  type KanbanColumn,
  type Task,
} from "@onezone/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";

interface EditTaskForm {
  name: string;
  description: string;
  columnId: string; // BACKLOG_COLUMN_ID sentinel or a real column UUID
  agentId: string;
  model: string;
  useTaskAgentAndModel: boolean;
}

interface EditTaskDialogProps {
  task: Task;
  projectId: string;
  agents: Agent[];
  columns: KanbanColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({
  task,
  projectId,
  agents,
  columns,
  open,
  onOpenChange,
}: EditTaskDialogProps) {
  const qc = useQueryClient();
  const [editorKey, setEditorKey] = useState(0);

  const methods = useForm<EditTaskForm>({
    defaultValues: {
      name: task.name,
      description: task.description ?? "",
      columnId: task.columnId ?? BACKLOG_COLUMN_ID,
      agentId: task.agentId,
      model: task.model,
      useTaskAgentAndModel: task.useTaskAgentAndModel,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = methods;

  const agentId = watch("agentId");
  const columnId = watch("columnId");

  useEffect(() => {
    if (open) {
      methods.reset({
        name: task.name,
        description: task.description ?? "",
        columnId: task.columnId ?? BACKLOG_COLUMN_ID,
        agentId: task.agentId,
        model: task.model,
        useTaskAgentAndModel: task.useTaskAgentAndModel,
      });
      setEditorKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (data: EditTaskForm) =>
      updateTask(task.id, {
        name: data.name,
        description: data.description,
        columnId: data.columnId === BACKLOG_COLUMN_ID ? null : data.columnId,
        agentId: data.agentId,
        model: data.model,
        useTaskAgentAndModel: data.useTaskAgentAndModel,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditTaskForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <FormProvider {...methods}>
          <DialogBody>
            <form id="edit-task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                {...register("name", { required: "Name is required" })}
                placeholder="Task name"
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <Select
                value={columnId}
                onValueChange={(v) =>
                  v != null && setValue("columnId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) =>
                      v === BACKLOG_COLUMN_ID
                        ? "Backlog"
                        : (columns.find((c) => c.id === v)?.name ?? v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BACKLOG_COLUMN_ID}>Backlog</SelectItem>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Agent</label>
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
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Input
                {...register("model", { required: "Model is required" })}
                placeholder="Model"
              />
              {errors.model && (
                <p className="text-xs text-destructive">
                  {errors.model.message}
                </p>
              )}
            </div>

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
                control={methods.control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Controller
                name="description"
                control={methods.control}
                render={({ field }) => (
                  <RichTextEditor
                    key={editorKey}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Task description (optional)"
                  />
                )}
              />
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
            <Button
              type="submit"
              form="edit-task-form"
              disabled={isSubmitting || mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
