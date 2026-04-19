import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const CreateTaskSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const SocketAuthSchema = z.object({
  taskId: z.string().uuid(),
  role: z.enum(['user', 'agent']),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type SocketAuthInput = z.infer<typeof SocketAuthSchema>;
