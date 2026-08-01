import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KanbanColumnsService, sanitizeKanbanColumnName, sanitizeKanbanColumnInstructions } from './kanban-columns.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Includes a column with no agent/model and one with an agent missing from the DB,
// so both the found/not-found and present/absent branches are exercised.
vi.mock('./constants.js', () => ({
  DEFAULT_KANBAN_COLUMNS: [
    { name: 'Plan', instructions: 'Plan it', index: 0, agent: 'Claude Code', model: 'model-a' },
    { name: 'Backlog Review', instructions: 'Review it', index: 1, agent: 'Missing Agent', model: 'model-b' },
    { name: 'Done', instructions: 'Finish it', index: 2 },
  ],
}));

const createMockPrisma = () => {
  const m = {
    kanbanColumn: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      createMany: vi.fn(),
    },
    agent: {
      findFirst: vi.fn(),
    },
    taskColumn: {
      deleteMany: vi.fn(),
    },
    task: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => {
      if (typeof fn === 'function') {
        return await fn(m);
      }
      // array of promises path
      return await Promise.all(fn);
    }),
  };
  return m as unknown as PrismaService;
};

describe('KanbanColumnsService', () => {
  let service: KanbanColumnsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new KanbanColumnsService(prisma);
  });

  describe('sanitizeKanbanColumnName', () => {
    it('returns trimmed string name', () => {
      expect(sanitizeKanbanColumnName('  Hello  ')).toBe('Hello');
    });

    it('throws BadRequestException for non-string', () => {
      expect(() => sanitizeKanbanColumnName(123 as any)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for empty string', () => {
      expect(() => sanitizeKanbanColumnName('   ')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for reserved name', () => {
      expect(() => sanitizeKanbanColumnName('backlog')).toThrow(BadRequestException);
    });
  });

  describe('sanitizeKanbanColumnInstructions', () => {
    it('returns undefined for undefined when optional', () => {
      expect(sanitizeKanbanColumnInstructions(undefined)).toBeUndefined();
    });

    it('throws BadRequestException for undefined when required', () => {
      expect(() => sanitizeKanbanColumnInstructions(undefined, true)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-string', () => {
      expect(() => sanitizeKanbanColumnInstructions(123 as any)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for empty string', () => {
      expect(() => sanitizeKanbanColumnInstructions('   ')).toThrow(BadRequestException);
    });

    it('returns trimmed instructions', () => {
      expect(sanitizeKanbanColumnInstructions('  hello  ')).toBe('hello');
    });
  });

  describe('findAllByProject', () => {
    it('returns columns for project', async () => {
      prisma.kanbanColumn.findMany.mockResolvedValue([
        { id: 'col-1', name: 'To Do', index: 0 },
      ]);
      const result = await service.findAllByProject('proj-1', 'user-1');
      expect(result).toHaveLength(1);
      expect(prisma.kanbanColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 'proj-1', userId: 'user-1' } }),
      );
    });

    it('returns columns without userId filter when omitted', async () => {
      prisma.kanbanColumn.findMany.mockResolvedValue([]);
      await service.findAllByProject('proj-1');
      expect(prisma.kanbanColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 'proj-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns column when found', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-1', userId: 'user-1' });
      const result = await service.findOne('col-1', 'proj-1', 'user-1');
      expect(result.id).toBe('col-1');
    });

    it('throws NotFoundException when not found', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue(null);
      await expect(service.findOne('col-1', 'proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when projectId mismatch', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-2', userId: 'user-1' });
      await expect(service.findOne('col-1', 'proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when userId mismatch', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-1', userId: 'user-2' });
      await expect(service.findOne('col-1', 'proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates column with defaults', async () => {
      prisma.kanbanColumn.aggregate.mockResolvedValue({ _max: { index: 1 } });
      prisma.kanbanColumn.create.mockResolvedValue({ id: 'col-2' });
      const result = await service.create('proj-1', { name: 'In Progress', instructions: 'Move here when started' }, 'user-1');
      expect(result).toHaveProperty('id', 'col-2');
      expect(prisma.kanbanColumn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'In Progress', instructions: 'Move here when started', index: 2 }),
        }),
      );
    });

    it('throws BadRequestException for reserved name', async () => {
      await expect(
        service.create('proj-1', { name: 'backlog', instructions: 'instructions' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults index to 0 when no existing columns', async () => {
      prisma.kanbanColumn.aggregate.mockResolvedValue({ _max: { index: null } });
      prisma.kanbanColumn.create.mockResolvedValue({ id: 'col-1' });
      await service.create('proj-1', { name: 'First', instructions: 'do it' }, 'user-1');
      expect(prisma.kanbanColumn.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ index: 0 }) }),
      );
    });
  });

  describe('createDefaults', () => {
    it('creates default columns, resolving found/missing agents and missing model', async () => {
      prisma.agent.findFirst.mockImplementation(async ({ where }: any) =>
        where.name === 'Claude Code' ? { id: 'agent-1' } : null,
      );
      prisma.kanbanColumn.createMany.mockResolvedValue({ count: 3 });
      prisma.kanbanColumn.findMany.mockResolvedValue([]);
      const result = await service.createDefaults('proj-1', 'user-1');
      expect(prisma.kanbanColumn.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Plan', agentId: 'agent-1', model: 'model-a' }),
            expect.objectContaining({ name: 'Backlog Review', agentId: null, model: 'model-b' }),
            expect.objectContaining({ name: 'Done', agentId: null, model: null }),
          ]),
        }),
      );
      expect(result).toEqual([]);
    });

    it('creates default columns inside a transaction when tx provided', async () => {
      const tx = {
        agent: { findFirst: vi.fn().mockResolvedValue({ id: 'agent-1' }) },
        kanbanColumn: { createMany: vi.fn().mockResolvedValue({ count: 2 }), findMany: vi.fn().mockResolvedValue([]) },
      };
      await service.createDefaults('proj-1', 'user-1', tx as any);
      expect(tx.kanbanColumn.createMany).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates column name', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-1', userId: 'user-1' });
      prisma.kanbanColumn.update.mockResolvedValue({ id: 'col-1', name: 'Done' });
      const result = await service.update('col-1', { name: 'Done' }, 'proj-1', 'user-1');
      expect(result.name).toBe('Done');
    });

    it('updates column with instructions', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-1', userId: 'user-1' });
      prisma.kanbanColumn.update.mockResolvedValue({ id: 'col-1', name: 'Done', instructions: 'Do this' });
      const result = await service.update('col-1', { name: 'Done', instructions: 'Do this' }, 'proj-1', 'user-1');
      expect(prisma.kanbanColumn.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ instructions: 'Do this' }) })
      );
    });

    it('throws NotFoundException when column not found', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue(null);
      await expect(service.update('col-1', { name: 'Done' }, 'proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('updates column agentId and model', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-1', userId: 'user-1' });
      prisma.kanbanColumn.update.mockResolvedValue({ id: 'col-1', agentId: 'agent-2', model: 'model-x' });
      const result = await service.update('col-1', { agentId: 'agent-2', model: 'model-x' }, 'proj-1', 'user-1');
      expect(prisma.kanbanColumn.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { agentId: 'agent-2', model: 'model-x' } }),
      );
      expect(result.agentId).toBe('agent-2');
    });
  });

  describe('remove', () => {
    it('deletes column when found', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue({ id: 'col-1', projectId: 'proj-1', userId: 'user-1' });
      prisma.kanbanColumn.delete.mockResolvedValue({ id: 'col-1' });
      await service.remove('col-1', 'proj-1', 'user-1');
      expect(prisma.kanbanColumn.delete).toHaveBeenCalledWith({ where: { id: 'col-1' } });
    });

    it('throws NotFoundException when column not found', async () => {
      prisma.kanbanColumn.findUnique.mockResolvedValue(null);
      await expect(service.remove('col-1', 'proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('reorders columns', async () => {
      prisma.kanbanColumn.findMany.mockResolvedValue([{ id: 'col-1' }, { id: 'col-2' }]);
      prisma.kanbanColumn.update.mockResolvedValue({});
      await service.reorder('proj-1', [
        { id: 'col-1', index: 1 },
        { id: 'col-2', index: 0 },
      ]);
      expect(prisma.kanbanColumn.update).toHaveBeenCalledTimes(2);
    });
  });
});
