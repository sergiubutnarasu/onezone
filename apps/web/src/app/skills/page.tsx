'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGlobalSkills, installGlobalSkill, removeGlobalSkill } from '@/lib/api';
import { SkillsManager } from '@/components/SkillsManager';
import type { ProjectSkill } from '@onezone/shared';

export default function GlobalSkillsPage() {
  const qc = useQueryClient();

  const { data: skills = [], isLoading } = useQuery<ProjectSkill[]>({
    queryKey: ['global-skills'],
    queryFn: fetchGlobalSkills,
  });

  const installMutation = useMutation({
    mutationFn: (data: { source: string; skillName: string }) => installGlobalSkill(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-skills'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (skillId: string) => removeGlobalSkill(skillId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-skills'] }),
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Global Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Skills available to all projects and their agents
        </p>
      </div>

      <SkillsManager
        skills={skills}
        isLoading={isLoading}
        onInstall={(data) => installMutation.mutate(data)}
        installPending={installMutation.isPending}
        installError={installMutation.isError ? (installMutation.error as Error) : null}
        onRemove={(id) => removeMutation.mutate(id)}
        removePending={removeMutation.isPending}
        variant="card"
      />
    </div>
  );
}

