"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProject } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ProjectInfo, Agent } from "@onezone/shared";

interface EditProjectForm {
  name: string;
  description: string;
  defaultAgentId: string;
  defaultModel: string;
}

interface EditProjectDialogProps {
  project: ProjectInfo;
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({
  project,
  agents,
  open,
  onOpenChange,
}: EditProjectDialogProps) {
  const qc = useQueryClient();

  console.log("Project", project);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditProjectForm>({
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
      defaultAgentId: project.defaultAgentId,
      defaultModel: project.defaultModel,
    },
  });

  const defaultAgentId = watch("defaultAgentId");

  const mutation = useMutation({
    mutationFn: (data: EditProjectForm) =>
      updateProject(project.id, {
        name: data.name,
        description: data.description,
        defaultAgentId: data.defaultAgentId,
        defaultModel: data.defaultModel,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
      reset();
    },
  });

  const onSubmit = (data: EditProjectForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3 pt-2"
        >
          <Input
            {...register("name", { required: "Name is required" })}
            placeholder="Project name"
            autoFocus
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
          <Input
            {...register("description")}
            placeholder="Description (optional)"
          />
          <Select
            value={defaultAgentId}
            onValueChange={(v) => setValue("defaultAgentId", v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) =>
                  v ? (
                    (agents.find((a) => a.id === v)?.name ?? v)
                  ) : (
                    <span className="text-muted-foreground">
                      Select default agent
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
          <Input {...register("defaultModel")} placeholder="Default model" />
          <Button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="w-full mt-1"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
