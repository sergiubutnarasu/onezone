'use client';

import { useState } from 'react';
import { Blocks, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { parseSkillCommand } from '@/lib/skills';
import type { ProjectSkill } from '@onezone/shared';

interface SkillsManagerProps {
  skills: ProjectSkill[];
  isLoading?: boolean;
  onInstall: (data: { source: string; skillName: string }) => void;
  installPending?: boolean;
  installError?: Error | null;
  onRemove: (skillId: string) => void;
  removePending?: boolean;
  /** 'compact' for inline dialog rows, 'card' for full-page cards with icon */
  variant?: 'compact' | 'card';
}

export function SkillsManager({
  skills,
  isLoading,
  onInstall,
  installPending,
  installError,
  onRemove,
  removePending,
  variant = 'compact',
}: SkillsManagerProps) {
  const [skillCmd, setSkillCmd] = useState('');
  const parsedSkill = parseSkillCommand(skillCmd);

  function handleInstall() {
    if (!parsedSkill) return;
    onInstall(parsedSkill);
    setSkillCmd('');
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Install form */}
      <div className="flex flex-col gap-2">
        <Input
          value={skillCmd}
          onChange={(e) => setSkillCmd(e.target.value)}
          placeholder="npx skills add vercel-labs/agent-skills --skill find-skills"
        />
        {skillCmd && !parsedSkill && (
          <p className="text-xs text-muted-foreground">
            Paste a <code>npx skills add &lt;source&gt; --skill &lt;name&gt;</code> command
          </p>
        )}
        {parsedSkill && (
          <p className="text-xs text-muted-foreground">
            Source: <span className="font-medium text-foreground">{parsedSkill.source}</span>
            {' · '}Skill: <span className="font-medium text-foreground">{parsedSkill.skillName}</span>
          </p>
        )}
        <Button onClick={handleInstall} disabled={!parsedSkill || installPending}>
          {installPending ? 'Installing…' : 'Install skill'}
        </Button>
        {installError && (
          <p className="text-xs text-destructive">{installError.message}</p>
        )}
      </div>

      {/* Skill list */}
      {isLoading ? (
        variant === 'card' ? (
          <>
            <SkillCardSkeleton />
            <SkillCardSkeleton />
          </>
        ) : null
      ) : skills.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No skills installed</p>
      ) : variant === 'card' ? (
        <div className="flex flex-col gap-3">
          {skills.map((skill) => (
            <Card key={skill.id} className="border-border/60">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
                    <Blocks className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{skill.skillName}</p>
                    <p className="text-xs text-muted-foreground truncate">{skill.source}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(skill.id)}
                  disabled={removePending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
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
                onClick={() => onRemove(skill.id)}
                disabled={removePending}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillCardSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardContent>
    </Card>
  );
}
