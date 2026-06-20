// apps/server/src/libs/runner-command.ts

import { parseRunnerPayload } from '@onezone/shared';

interface RunnerPayload {
  taskName?: string;
  kanbanColumnName?: string;
}

export function parseRunnerCommand(command: string): RunnerPayload | null {
  return parseRunnerPayload<RunnerPayload>(command);
}
