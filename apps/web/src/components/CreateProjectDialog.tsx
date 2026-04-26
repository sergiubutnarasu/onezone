"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/api";
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
import type { Agent } from "@onezone/shared";

interface CreateProjectForm {
  name: string;
  description: string;
  defaultAgentId: string;
  defaultModel: string;
}

interface CreateProjectDialogProps {
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
  agents,
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectForm>({
    defaultValues: {
      name: "",
      description: "",
      defaultAgentId: agents[0]?.id ?? "",
      defaultModel: agents[0]?.model ?? "",
    },
  });

  const defaultAgentId = watch("defaultAgentId");

  useEffect(() => {
    if (open && agents.length > 0) {
      reset({
        name: "",
        description: "",
        defaultAgentId: agents[0].id,
        defaultModel: agents[0].model,
      });
    }
  }, [open, agents, reset]);

  const mutation = useMutation({
    mutationFn: (data: CreateProjectForm) =>
      createProject({
        name: data.name,
        description: data.description,
        defaultAgentId: data.defaultAgentId,
        defaultModel: data.defaultModel,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
      reset();
    },
  });

  const onSubmit = (data: CreateProjectForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
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

          <Select
            value={defaultAgentId}
            onValueChange={(v) => {
              setValue("defaultAgentId", v ?? "");
              const agent = agents.find((a) => a.id === v);
              if (agent) setValue("defaultModel", agent.model);
            }}
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
          <Input
            {...register("defaultModel", {
              required: "Default model is required",
            })}
            placeholder="Default model"
          />
          {errors.defaultModel && (
            <p className="text-xs text-destructive">
              {errors.defaultModel.message}
            </p>
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
            disabled={isSubmitting || mutation.isPending}
            className="w-full mt-1"
          >
            {mutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
