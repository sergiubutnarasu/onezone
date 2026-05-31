"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CRON_PRESETS,
  type Agent,
  type KanbanColumn,
  type ProjectInfo,
  type TaskSchedule,
  type Terminal,
} from "@onezone/shared";
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  runScheduleNow,
  type ScheduleInput,
  updateSchedule,
} from "@/lib/api";
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
import { Pencil, Play, Plus, Trash2 } from "lucide-react";

interface Props {
  projectId: string;
  project: ProjectInfo | null;
  terminals: Terminal[];
  agents: Agent[];
  columns: KanbanColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ScheduleForm = ScheduleInput;

const CUSTOM_PRESET = "__custom__";

const emptyForm = (project: ProjectInfo | null, columns: KanbanColumn[], terminals: Terminal[]): ScheduleForm => ({
  name: "",
  description: "",
  cronExpression: CRON_PRESETS[0].value,
  timezone: "",
  startColumnId: columns[0]?.id ?? "",
  terminalId: terminals[0]?.id ?? "",
  agentId: project?.defaultAgentId ?? "",
  model: project?.defaultModel ?? "",
  useScheduleAgentAndModel: false,
  enabled: true,
  runOnce: false,
});

export function SchedulesDialog({
  projectId,
  project,
  terminals,
  agents,
  columns,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TaskSchedule | null>(null);
  const [mode, setMode] = useState<"list" | "form">("list");

  const { data: schedules = [], isLoading } = useQuery<TaskSchedule[]>({
    queryKey: ["schedules", projectId],
    queryFn: () => fetchSchedules(projectId),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setMode("list");
    }
  }, [open]);

  const removeMut = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules", projectId] }),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => runScheduleNow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateSchedule(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules", projectId] }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "list" ? "Task schedules" : editing ? "Edit schedule" : "New schedule"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {mode === "list" ? (
            <div className="flex flex-col gap-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schedules yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/60 rounded-md border border-border/60">
                  {schedules.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{s.name}</span>
                          {s.runOnce && (
                            <span className="text-[10px] uppercase rounded bg-muted px-1.5 py-0.5">
                              once
                            </span>
                          )}
                          {!s.enabled && (
                            <span className="text-[10px] uppercase rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              paused
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {s.cronExpression}
                          {s.timezone ? ` (${s.timezone})` : ""}
                          {" · "}
                          {s.startColumn?.name ?? s.startColumnId}
                          {" · runs: "}
                          {s.runCount}
                        </div>
                      </div>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) =>
                          toggleMut.mutate({ id: s.id, enabled: v })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Run now"
                        disabled={runMut.isPending}
                        onClick={() => runMut.mutate(s.id)}
                      >
                        <Play className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit"
                        onClick={() => {
                          setEditing(s);
                          setMode("form");
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Delete schedule "${s.name}"?`)) {
                            removeMut.mutate(s.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ScheduleForm
              key={editing?.id ?? "new"}
              projectId={projectId}
              project={project}
              terminals={terminals}
              agents={agents}
              columns={columns}
              initial={editing}
              onDone={() => {
                setEditing(null);
                setMode("list");
                qc.invalidateQueries({ queryKey: ["schedules", projectId] });
              }}
              onCancel={() => {
                setEditing(null);
                setMode("list");
              }}
            />
          )}
        </DialogBody>
        {mode === "list" && (
          <DialogFooter>
            <Button
              onClick={() => {
                setEditing(null);
                setMode("form");
              }}
              disabled={columns.length === 0 || terminals.length === 0}
            >
              <Plus className="size-4 mr-1" />
              New schedule
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  projectId: string;
  project: ProjectInfo | null;
  terminals: Terminal[];
  agents: Agent[];
  columns: KanbanColumn[];
  initial: TaskSchedule | null;
  onDone: () => void;
  onCancel: () => void;
}

function ScheduleForm({
  projectId,
  project,
  terminals,
  agents,
  columns,
  initial,
  onDone,
  onCancel,
}: FormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleForm>({
    defaultValues: initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          cronExpression: initial.cronExpression,
          timezone: initial.timezone ?? "",
          startColumnId: initial.startColumnId,
          terminalId: initial.terminalId,
          agentId: initial.agentId,
          model: initial.model,
          useScheduleAgentAndModel: initial.useScheduleAgentAndModel,
          enabled: initial.enabled,
          runOnce: initial.runOnce,
        }
      : emptyForm(project, columns, terminals),
  });

  const cronExpression = watch("cronExpression");
  const matchedPreset = CRON_PRESETS.find((p) => p.value === cronExpression);
  const [presetValue, setPresetValue] = useState<string>(
    matchedPreset ? matchedPreset.value : CUSTOM_PRESET,
  );

  const startColumnId = watch("startColumnId");
  const terminalId = watch("terminalId");
  const agentId = watch("agentId");

  const mutation = useMutation({
    mutationFn: (data: ScheduleForm) => {
      const payload: ScheduleInput = {
        ...data,
        description: data.description || undefined,
        timezone: data.timezone || undefined,
      };
      return initial
        ? updateSchedule(initial.id, payload)
        : createSchedule(projectId, payload);
    },
    onSuccess: () => onDone(),
  });

  const onSubmit = (data: ScheduleForm) => mutation.mutate(data);

  return (
    <form
      id="schedule-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 py-1"
    >
      <Input
        {...register("name", { required: "Name is required" })}
        placeholder="Schedule name"
        autoFocus
      />
      {errors.name && (
        <p className="text-xs text-destructive">{errors.name.message}</p>
      )}

      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <RichTextEditor
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="Task description (optional)"
          />
        )}
      />

      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">Cron schedule</label>
        <Select
          value={presetValue}
          onValueChange={(v) => {
            if (v == null) return;
            setPresetValue(v);
            if (v !== CUSTOM_PRESET) {
              setValue("cronExpression", v, { shouldValidate: true });
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => {
                if (v === CUSTOM_PRESET) return "Custom";
                const p = CRON_PRESETS.find((x) => x.value === v);
                return p ? p.label : "Custom";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CRON_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value} label={p.label}>
                {p.label}{" "}
                <span className="text-xs text-muted-foreground font-mono">
                  ({p.value})
                </span>
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_PRESET} label="Custom">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          {...register("cronExpression", { required: "Cron expression required" })}
          placeholder="* * * * *"
          className="font-mono"
          onChange={(e) => {
            setValue("cronExpression", e.target.value, { shouldValidate: true });
            const p = CRON_PRESETS.find((x) => x.value === e.target.value);
            setPresetValue(p ? p.value : CUSTOM_PRESET);
          }}
        />
        {errors.cronExpression && (
          <p className="text-xs text-destructive">{errors.cronExpression.message}</p>
        )}
        <Input
          {...register("timezone")}
          placeholder="Timezone (optional, e.g. Europe/Bucharest)"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">Start column</label>
        <Select
          value={startColumnId}
          onValueChange={(v) =>
            v != null && setValue("startColumnId", v, { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) =>
                v ? (columns.find((c) => c.id === v)?.name ?? v) : (
                  <span className="text-muted-foreground">Select a column</span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.id} value={c.id} label={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">Terminal</label>
        <Select
          value={terminalId}
          onValueChange={(v) =>
            v != null && setValue("terminalId", v, { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) =>
                v ? (terminals.find((t) => t.id === v)?.name ?? v) : (
                  <span className="text-muted-foreground">Select a terminal</span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {terminals.map((t) => (
              <SelectItem key={t.id} value={t.id} label={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">Agent</label>
        <Select
          value={agentId}
          onValueChange={(v) =>
            v != null && setValue("agentId", v, { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) =>
                v ? (agents.find((a) => a.id === v)?.name ?? v) : (
                  <span className="text-muted-foreground">Select an agent</span>
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

      <Input
        {...register("model", { required: "Model is required" })}
        placeholder="Model"
      />
      {errors.model && (
        <p className="text-xs text-destructive">{errors.model.message}</p>
      )}

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Override column agent &amp; model</p>
          <p className="text-xs text-muted-foreground">
            Use this schedule&apos;s agent/model instead of the column&apos;s.
          </p>
        </div>
        <Controller
          name="useScheduleAgentAndModel"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Run once</p>
          <p className="text-xs text-muted-foreground">
            Disable after the first successful run.
          </p>
        </div>
        <Controller
          name="runOnce"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Enabled</p>
          <p className="text-xs text-muted-foreground">
            Schedule actively fires when enabled.
          </p>
        </div>
        <Controller
          name="enabled"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {mutation.error && (
        <p className="text-xs text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending
            ? "Saving…"
            : initial
              ? "Save"
              : "Create schedule"}
        </Button>
      </div>
    </form>
  );
}
