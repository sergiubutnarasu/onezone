"use client";

import { useForm, FormProvider, Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask } from "@/lib/api";
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
import { TaskStatus, type Task, type Agent } from "@onezone/shared";
import { TaskStatusSelect } from "./TaskStatusSelect";

interface EditTaskForm {
  name: string;
  description: string;
  status: TaskStatus;
  agentId: string;
  model: string;
}

interface EditTaskDialogProps {
  task: Task;
  projectId: string;
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({
  task,
  projectId,
  agents,
  open,
  onOpenChange,
}: EditTaskDialogProps) {
  const qc = useQueryClient();
  const [editorKey, setEditorKey] = useState(0);

  const methods = useForm<EditTaskForm>({
    defaultValues: {
      name: task.name,
      description: task.description ?? "",
      status: task.status,
      agentId: task.agentId,
      model: task.model,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = methods;

  const agentId = watch("agentId");

  useEffect(() => {
    if (open) {
      methods.reset({
        name: task.name,
        description: task.description ?? "",
        status: task.status,
        agentId: task.agentId,
        model: task.model,
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
        status: data.status,
        agentId: data.agentId,
        model: data.model,
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
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
              <label className="text-sm font-medium">Status</label>
              <TaskStatusSelect />
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
                    <SelectItem key={a.id} value={a.id} label={a.name}>
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || mutation.isPending}
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
