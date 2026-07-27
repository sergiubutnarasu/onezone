"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject, runProjectBuilder } from "@/lib/api";
import type { ProjectInfo as Project, Terminal } from "@onezone/shared";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
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
  terminalId: string;
  boardPrompt: string;
}

interface ProjectFormProps {
  agents: Agent[];
  terminals?: Terminal[];
  enableBoardGeneration?: boolean;
  /** id attribute used to connect an external submit button via `form="..."`. */
  formId: string;
  /** Reset the form when this becomes true (e.g. dialog opening). */
  resetSignal?: unknown;
  onSuccess?: (project?: Project) => void;
  onProjectBuilderStarted?: (pending: {
    name: string;
    terminalName?: string;
  }) => void;
  /** Renders the submit button. Placed by the caller (DialogFooter, step footer, …). */
  renderFooter?: (state: { isSubmitting: boolean }) => ReactNode;
}

export function ProjectForm({
  agents,
  terminals = [],
  enableBoardGeneration = false,
  formId,
  resetSignal,
  onSuccess,
  onProjectBuilderStarted,
  renderFooter,
}: ProjectFormProps) {
  const qc = useQueryClient();
  const [generateBoard, setGenerateBoard] = useState(false);
  const connectedTerminals = terminals.filter((terminal) => terminal.isConnected);
  const firstConnectedTerminalId = connectedTerminals[0]?.id ?? "";
  const canGenerateBoard = enableBoardGeneration && connectedTerminals.length > 0;
  const showBoardGenerator = canGenerateBoard && generateBoard;

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
      terminalId: firstConnectedTerminalId,
      boardPrompt: "",
    },
  });

  const defaultAgentId = watch("defaultAgentId");
  const terminalId = watch("terminalId");

  useEffect(() => {
    reset({
      name: "",
      description: "",
      repository: "",
      defaultAgentId: agents[0]?.id ?? "",
      defaultModel: agents[0]?.model ?? "",
      terminalId: firstConnectedTerminalId,
      boardPrompt: "",
    });
    // Reset only when the caller signals (e.g. dialog reopening). Must NOT
    // also depend on agents/terminals — if that data loads or refreshes
    // while the dialog is open, re-running this would silently wipe out
    // whatever the user has already typed (name, description, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal, reset]);

  // Backfill the default agent once its data loads, without touching fields
  // the user may have already started typing.
  useEffect(() => {
    if (!defaultAgentId && agents[0]) {
      setValue("defaultAgentId", agents[0].id);
      setValue("defaultModel", agents[0].model);
    }
  }, [agents, defaultAgentId, setValue]);

  // Same idea for the terminal selector.
  useEffect(() => {
    if (!terminalId && firstConnectedTerminalId) {
      setValue("terminalId", firstConnectedTerminalId);
    }
  }, [firstConnectedTerminalId, terminalId, setValue]);

  useEffect(() => {
    if (resetSignal) setGenerateBoard(false);
  }, [resetSignal]);

  useEffect(() => {
    if (!canGenerateBoard && generateBoard) setGenerateBoard(false);
  }, [canGenerateBoard, generateBoard]);

  const buildBoardBuilderDescription = (prompt: string) =>
    [
      "Use the onezone-project-builder skill to create this project and generate its kanban board.",
      "The skill must create the project by calling the onezone-terminal project new command.",
      "Generate focused columns for this request:",
      prompt.trim(),
    ].join("\n\n");

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      if (showBoardGenerator) {
        const result = await runProjectBuilder(data.terminalId, {
          name: data.name,
          description: data.description || undefined,
          repository: data.repository || undefined,
          boardPrompt: buildBoardBuilderDescription(data.boardPrompt),
          agentId: data.defaultAgentId,
          model: data.defaultModel,
        });
        return result.project;
      }

      return createProject({
        name: data.name,
        description: data.description,
        repository: data.repository || undefined,
        defaultAgentId: data.defaultAgentId,
        defaultModel: data.defaultModel,
      });
    },
    onSuccess: (project, data) => {
      if (project) {
        qc.setQueryData<Project[]>(["projects"], (current = []) => {
          if (current.some((item) => item.id === project.id)) return current;
          return [project, ...current];
        });
      }
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (showBoardGenerator) {
        onProjectBuilderStarted?.({
          name: data.name,
          terminalName: connectedTerminals.find((terminal) => terminal.id === data.terminalId)?.name,
        });
        [3000, 8000, 15000].forEach((delay) => {
          window.setTimeout(() => {
            qc.invalidateQueries({ queryKey: ["projects"] });
          }, delay);
        });
      }
      reset();
      onSuccess?.(project ?? undefined);
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
        {canGenerateBoard && (
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                !generateBoard
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setGenerateBoard(false)}
            >
              Manual
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                generateBoard
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setGenerateBoard(true)}
            >
              Generate with AI
            </button>
          </div>
        )}

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

        {showBoardGenerator && (
          <>
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
                      (connectedTerminals.find((t) => t.id === v)?.name ?? v)
                    ) : (
                      <span className="text-muted-foreground">
                        Select a terminal
                      </span>
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {connectedTerminals.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No connected terminals
                  </div>
                ) : (
                  connectedTerminals.map((t) => (
                    <SelectItem key={t.id} value={t.id} label={t.name}>
                      <span className="mr-1.5 text-emerald-400">●</span>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.terminalId && (
              <p className="text-xs text-destructive">
                {errors.terminalId.message}
              </p>
            )}

            <Textarea
              {...register("boardPrompt", {
                validate: (value) =>
                  value.trim().length > 0 || "Describe the board you want",
              })}
              placeholder="Describe the board you want AI to generate"
              className="min-h-28 resize-none"
            />
            {errors.boardPrompt && (
              <p className="text-xs text-destructive">
                {errors.boardPrompt.message}
              </p>
            )}
          </>
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
      {renderFooter?.({ isSubmitting: submitting })}
    </>
  );
}
