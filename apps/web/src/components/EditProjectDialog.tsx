"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { updateProject, deleteProject, fetchProjectSkills, installProjectSkill, removeProjectSkill } from "@/lib/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Controller } from "react-hook-form";
import { Trash2 } from "lucide-react";
import type { ProjectInfo, Agent } from "@onezone/shared";

interface EditProjectForm {
  name: string;
  description: string;
  repository: string;
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
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [skillCmd, setSkillCmd] = useState("");

  const parsedSkill = (() => {
    // Accept: `npx skills add <source> --skill <name>` or just `<source> --skill <name>`
    const m = skillCmd.match(/(?:npx\s+(?:--yes\s+)?skills\s+add\s+)?(\S+)\s+--skill\s+(\S+)/);
    if (!m) return null;
    return { source: m[1], skillName: m[2] };
  })();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditProjectForm>({
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
      repository: project.repository ?? "",
      defaultAgentId: project.defaultAgentId,
      defaultModel: project.defaultModel,
    },
  });

  const defaultAgentId = watch("defaultAgentId");

  useEffect(() => {
    if (open) {
      reset({
        name: project.name,
        description: project.description ?? "",
        repository: project.repository ?? "",
        defaultAgentId: project.defaultAgentId,
        defaultModel: project.defaultModel,
      });
      setEditorKey((k) => k + 1);
      setSkillCmd("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (data: EditProjectForm) =>
      updateProject(project.id, {
        name: data.name,
        description: data.description,
        repository: data.repository || null,
        defaultAgentId: data.defaultAgentId,
        defaultModel: data.defaultModel,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
      router.push("/");
    },
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["project-skills", project.id],
    queryFn: () => fetchProjectSkills(project.id),
    enabled: open,
  });

  const installMutation = useMutation({
    mutationFn: () => {
      if (!parsedSkill) throw new Error("Invalid command");
      return installProjectSkill(project.id, parsedSkill);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-skills", project.id] });
      setSkillCmd("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (skillId: string) => removeProjectSkill(project.id, skillId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-skills", project.id] });
    },
  });

  const onSubmit = (data: EditProjectForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setConfirmDelete(false); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="skills" className="flex-1">Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-3">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-3"
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

              <Button
                type="submit"
                disabled={isSubmitting || mutation.isPending}
                className="w-full mt-1"
              >
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>

            <div className="border-t border-border/60 pt-3 mt-3">
              {confirmDelete ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-destructive font-medium">
                    Delete &ldquo;{project.name}&rdquo;? This will permanently remove all its tasks and disconnect any assigned terminals.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleteMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete project
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="skills" className="mt-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Input
                  value={skillCmd}
                  onChange={(e) => setSkillCmd(e.target.value)}
                  placeholder="npx skills add vercel-labs/agent-skills --skill find-skills"
                />
                {skillCmd && !parsedSkill && (
                  <p className="text-xs text-muted-foreground">Paste a <code>npx skills add &lt;source&gt; --skill &lt;name&gt;</code> command</p>
                )}
                {parsedSkill && (
                  <p className="text-xs text-muted-foreground">
                    Source: <span className="font-medium text-foreground">{parsedSkill.source}</span>
                    {" · "}Skill: <span className="font-medium text-foreground">{parsedSkill.skillName}</span>
                  </p>
                )}
                <Button
                  onClick={() => installMutation.mutate()}
                  disabled={!parsedSkill || installMutation.isPending}
                >
                  {installMutation.isPending ? "Installing…" : "Install skill"}
                </Button>
                {installMutation.isError && (
                  <p className="text-xs text-destructive">
                    {(installMutation.error as Error).message}
                  </p>
                )}
              </div>

              {skills.length > 0 && (
                <div className="border-t border-border/60 pt-3 flex flex-col gap-1">
                  {skills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between gap-2 py-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{skill.skillName}</p>
                        <p className="text-xs text-muted-foreground truncate">{skill.source}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMutation.mutate(skill.id)}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {skills.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No skills installed</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

