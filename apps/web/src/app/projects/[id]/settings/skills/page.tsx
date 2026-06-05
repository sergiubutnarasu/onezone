"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchProjectSkills,
  installProjectSkill,
  removeProjectSkill,
} from "@/lib/api";
import { SkillsManager } from "@/components/SkillsManager";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function ProjectSkillsSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["project-skills", id],
    queryFn: () => fetchProjectSkills(id),
  });

  const installMutation = useMutation({
    mutationFn: (data: { source: string; skillName: string }) =>
      installProjectSkill(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-skills", id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (skillId: string) => removeProjectSkill(id, skillId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-skills", id] });
    },
  });

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>
            Install skills from npm packages to extend agent capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkillsManager
            skills={skills}
            isLoading={isLoading}
            onInstall={(data) => installMutation.mutate(data)}
            installPending={installMutation.isPending}
            installError={
              installMutation.isError ? (installMutation.error as Error) : null
            }
            onRemove={(skillId) => removeMutation.mutate(skillId)}
            removePending={removeMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
