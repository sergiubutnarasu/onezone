"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { updateProject, fetchAgents, fetchProject } from "@/lib/api";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Controller } from "react-hook-form";
import type { Agent } from "@onezone/shared";

interface EditProjectForm {
  name: string;
  description: string;
  repository: string;
  defaultAgentId: string;
  defaultModel: string;
}

export default function ProjectDetailsSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editorKey, setEditorKey] = useState(0);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditProjectForm>({
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      repository: project?.repository ?? "",
      defaultAgentId: project?.defaultAgentId ?? "",
      defaultModel: project?.defaultModel ?? "",
    },
  });

  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description ?? "",
        repository: project.repository ?? "",
        defaultAgentId: project.defaultAgentId,
        defaultModel: project.defaultModel,
      });
      setEditorKey((k) => k + 1);
    }
  }, [project, reset]);

  const defaultAgentId = watch("defaultAgentId");

  const mutation = useMutation({
    mutationFn: (data: EditProjectForm) =>
      updateProject(id, {
        name: data.name,
        description: data.description,
        repository: data.repository || null,
        defaultAgentId: data.defaultAgentId,
        defaultModel: data.defaultModel,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const onSubmit = (data: EditProjectForm) => {
    mutation.mutate(data);
  };

  if (projectLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-40 w-full bg-muted rounded-xl animate-pulse" />
        <div className="h-40 w-full bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* General info */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Basic project information and defaults
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                {...register("name", { required: "Name is required" })}
                placeholder="Project name"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Repository</label>
              <Input
                {...register("repository")}
                placeholder="Repository URL (optional)"
                type="url"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <RichTextEditor
                    key={editorKey}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Description (optional)"
                  />
                )}
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={isSubmitting || mutation.isPending || !isDirty}
              >
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            Default agent and model for new tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Default agent</label>
            <Select
              value={defaultAgentId}
              onValueChange={(v) => setValue("defaultAgentId", v ?? "", { shouldDirty: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v ? (
                      agents.find((a) => a.id === v)?.name ?? v
                    ) : (
                      <span className="text-muted-foreground">Select default agent</span>
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

          <div className="space-y-1">
            <label className="text-sm font-medium">Default model</label>
            <Input
              {...register("defaultModel")}
              placeholder="Default model"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || mutation.isPending || !isDirty}
            >
              {mutation.isPending ? "Saving…" : "Save defaults"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
