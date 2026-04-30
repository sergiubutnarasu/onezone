// packages/shared/src/schemas.ts

import { z } from 'zod';

const baseEntitySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const CreateProjectSchema = baseEntitySchema.extend({
  defaultAgentId: z.string(),
  defaultModel: z.string(),
});

export const CreateTaskSchema = baseEntitySchema.extend({
  terminalId: z.string(),
  agentId: z.string(),
  model: z.string(),
});

export const SocketAuthSchema = z.object({
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  role: z.enum(['user', 'terminal']),
  terminalId: z.string().optional(),
  terminalName: z.string().optional(),
  terminalHostname: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type SocketAuthInput = z.infer<typeof SocketAuthSchema>;
