"use client";

import { useEffect, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject, type Project } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@onezone/shared";

interface ProjectFormValues {
  name: string;
  description: string;
  repository: string;
  defaultAgentId: string;
  defaultModel: string;
}

interface ProjectFormProps {
  agents: Agent[];
  /** id attribute used to connect an external submit button via `form="..."`. */
  formId: string;
  /** Reset the form when this becomes true (e.g. dialog opening). */
  resetSignal?: unknown;
  onSuccess?: (project: Project) => void;
  /** Renders the submit button. Placed by the caller (DialogFooter, step footer, …). */
  renderFooter: (state: { isSubmitting: boolean }) => ReactNode;
}

export function ProjectForm({
  agents,
  formId,
  resetSignal,
  onSuccess,
  renderFooter,
}: ProjectFormProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      name: "",
      description: "",
      repository: "",
      defaultAgentId: agents[0]?.id ?? "",
      defaultModel: agents[0]?.model ?? "",
    },
  });

  const defaultAgentId = watch("defaultAgentId");

  useEffect(() => {
    if (agents.length > 0) {
      reset({
        name: "",
        description: "",
        repository: "",
        defaultAgentId: agents[0].id,
        defaultModel: agents[0].model,
      });
    }
    // Reset whenever the caller signals (e.g. dialog reopening) or agents load.
  }, [resetSignal, agents, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProjectFormValues) =>
      createProject({
        name: data.name,
        description: data.description,
        repository: data.repository || undefined,
        defaultAgentId: data.defaultAgentId,
        defaultModel: data.defaultModel,
      }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      reset();
      onSuccess?.(project);
    },
  });

  const submitting = isSubmitting || mutation.isPending;

  return (
    <>
      <form
        id={formId}
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="flex flex-col gap-3 py-1"
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
          {...register("repository")}
          placeholder="Repository URL (optional)"
          type="url"
        />

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
      </form>
      {renderFooter({ isSubmitting: submitting })}
    </>
  );
}
