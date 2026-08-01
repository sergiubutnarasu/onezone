import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagesService } from './messages.service.js';
import { MessageType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';

const createMockPrisma = () =>
  ({
    message: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  } as unknown as PrismaService);

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new MessagesService(prisma);
  });

  describe('create', () => {
    it('creates a message with BigInt timestamp', async () => {
      const dto = {
        taskId: 'task-1',
        role: 'user',
        content: 'Hello',
        ts: 1234567890,
      };
      prisma.message.create.mockResolvedValue({ id: 'msg-1', ...dto, ts: BigInt(dto.ts) });

      const result = await service.create(dto as any);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          ts: BigInt(dto.ts),
        },
      });
    });
  });

  describe('hasCommandExit', () => {
    it('returns true when command exit exists', async () => {
      prisma.message.count.mockResolvedValue(1);
      const result = await service.hasCommandExit('task-1', 'job-1', 'user-1');
      expect(result).toBe(true);
      expect(prisma.message.count).toHaveBeenCalledWith({
        where: {
          taskId: 'task-1',
          jobId: 'job-1',
          userId: 'user-1',
          OR: [
            { messageType: MessageType.COMMAND_EXIT },
            { exitCode: { not: null } },
          ],
        },
      });
    });

    it('returns false when no command exit exists', async () => {
      prisma.message.count.mockResolvedValue(0);
      const result = await service.hasCommandExit('task-1', 'job-1', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('findByTask', () => {
    it('returns messages with agentName and numeric ts', async () => {
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          taskId: 'task-1',
          content: 'Hello',
          ts: BigInt(1234567890),
          agent: { name: 'Claude' },
        },
        {
          id: 'msg-2',
          taskId: 'task-1',
          content: 'World',
          ts: BigInt(1234567891),
          agent: null,
        },
      ]);

      const result = await service.findByTask('task-1', 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('agentName', 'Claude');
      expect(result[0]).toHaveProperty('ts', 1234567890);
      expect(result[1]).toHaveProperty('agentName', null);
      expect(result[1]).toHaveProperty('ts', 1234567891);
      expect(result[0]).toHaveProperty('agent', undefined);
    });
  });
});
