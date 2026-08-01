import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksService } from './tasks.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TerminalRegistryService } from '../gateways/terminal-registry.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MessageType, NotificationType } from '@prisma/client';

const createMockPrisma = () =>
  ({
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    taskTerminal: {
      create: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    taskColumn: {
      create: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    terminal: {
      findUnique: vi.fn(),
    },
    kanbanColumn: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    projectSkill: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    agent: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaService);

const createMockTerminalRegistry = () =>
  ({
    assignTask: vi.fn(),
    notifyTaskColumnUpdated: vi.fn(),
    notifyCommandExit: vi.fn(),
    cleanupTaskRoom: vi.fn(),
    evictTaskTerminal: vi.fn(),
    disconnectTaskTerminal: vi.fn(),
  } as unknown as TerminalRegistryService);

const createMockNotificationsService = () =>
  ({
    create: vi.fn(),
  } as unknown as NotificationsService);

describe('TasksService', () => {
  let service: TasksService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let terminalRegistry: ReturnType<typeof createMockTerminalRegistry>;
  let notificationsService: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    terminalRegistry = createMockTerminalRegistry();
    notificationsService = createMockNotificationsService();
    service = new TasksService(prisma, terminalRegistry, notificationsService);
  });

  describe('create', () => {
    it('creates a task with defaults', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        defaultAgentId: 'agent-1',
        defaultModel: 'claude-3',
      });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1' });
      prisma.task.count.mockResolvedValue(0);
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        name: 'Task 1',
        agent: null,
        columnAssignment: null,
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      });
      prisma.task.create.mockResolvedValue({ id: 'task-1', name: 'Task 1' });
      prisma.task.findUniqueOrThrow.mockResolvedValue({
        id: 'task-1',
        name: 'Task 1',
        terminalAssignment: { terminal: { id: 'term-1', name: 'Terminal 1' } },
        columnAssignment: null,
        agent: { id: 'agent-1', name: 'Claude', tag: 'ClaudeCode' },
      });

      const txMock = {
        task: {
          create: vi.fn().mockResolvedValue({ id: 'task-1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'task-1',
            name: 'Task 1',
            terminalAssignment: { terminal: { id: 'term-1', name: 'Terminal 1' } },
            columnAssignment: null,
            agent: { id: 'agent-1', name: 'Claude', tag: 'ClaudeCode' },
          }),
        },
        taskTerminal: { create: vi.fn() },
        taskColumn: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return await fn(txMock);
        return Promise.resolve();
      });

      const result = await service.create('proj-1', {
        name: 'Task 1',
        terminalId: 'term-1',
        userId: 'user-1',
      });
      expect(result).toHaveProperty('id', 'task-1');
    });

    it('creates a task with columnId', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        defaultAgentId: 'agent-1',
        defaultModel: 'claude-3',
      });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1' });
      prisma.kanbanColumn.findUnique.mockResolvedValue({
        id: 'col-1',
        projectId: 'proj-1',
        userId: 'user-1',
        name: 'To Do',
      });
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        name: 'Task 1',
        agent: null,
        columnAssignment: { column: { id: 'col-1', name: 'To Do' } },
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      });
      prisma.task.count.mockResolvedValue(0);

      const txMock = {
        task: {
          create: vi.fn().mockResolvedValue({ id: 'task-1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'task-1',
            name: 'Task 1',
            terminalAssignment: { terminal: { id: 'term-1', name: 'Terminal 1' } },
            columnAssignment: { column: { id: 'col-1', name: 'To Do', projectId: 'proj-1' } },
            agent: null,
          }),
        },
        taskTerminal: { create: vi.fn() },
        taskColumn: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return await fn(txMock);
        return Promise.resolve();
      });

      await service.create('proj-1', {
        name: 'Task 1',
        terminalId: 'term-1',
        columnId: 'col-1',
        userId: 'user-1',
      });
    });
  });

  describe('findAllByProject', () => {
    it('returns tasks for project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          name: 'Task 1',
          terminalAssignment: { terminal: { id: 'term-1', name: 'Terminal 1' } },
          columnAssignment: { column: { id: 'col-1', name: 'To Do' } },
        },
      ]);
      const result = await service.findAllByProject('proj-1', 'user-1');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      prisma.task.findMany.mockResolvedValue([]);
      const result = await service.findAllByProject('proj-1', 'user-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('returns task when found', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        name: 'Task 1',
        agent: { id: 'agent-1', name: 'Claude', tag: 'ClaudeCode' },
        columnAssignment: { column: { id: 'col-1', name: 'To Do' } },
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      });
      const result = await service.findOne('task-1', 'user-1');
      expect(result).toHaveProperty('id', 'task-1');
    });

    it('throws NotFoundException when task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.findOne('task-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates task name', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Old Name',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        })
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'New Name',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        });
      prisma.task.update.mockResolvedValue({ id: 'task-1', name: 'New Name' });
      const result = await service.update('task-1', { name: 'New Name' }, 'user-1');
      expect(result.name).toBe('New Name');
    });

    it('calls findOne when no fields to update', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Task 1',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        })
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Task 1',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        });
      const result = await service.update('task-1', {}, 'user-1');
      expect(result.name).toBe('Task 1');
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.update('task-1', { name: 'New Name' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates task column', async () => {
      const col = { id: 'col-1', name: 'To Do', createdAt: new Date(), instructions: '', index: 0, projectId: 'proj-1', userId: 'user-1' };
      const taskWithProject = {
        id: 'task-1',
        name: 'Task 1',
        agent: null,
        columnAssignment: null,
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      };
      const taskWithColumn = {
        id: 'task-1',
        name: 'Task 1',
        agent: null,
        columnAssignment: { columnId: 'col-1', column: col },
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      };
      prisma.task.findUnique
        .mockResolvedValueOnce(taskWithProject) // first findOne in update
        .mockResolvedValueOnce(taskWithProject) // findOne inside updateColumn
        .mockResolvedValueOnce(taskWithColumn) // final findOne in updateColumn
        .mockResolvedValueOnce(taskWithColumn); // final findOne in update
      prisma.kanbanColumn.findUnique.mockResolvedValue(col);
      prisma.task.update.mockResolvedValue({ id: 'task-1', name: 'Task 1' });
      prisma.$transaction.mockImplementation(async (fn) => await fn(prisma));
      prisma.taskColumn.upsert.mockResolvedValue({ id: 'tc-1' });
      prisma.message.findMany.mockResolvedValue([]);
      prisma.message.count.mockResolvedValue(0);
      prisma.projectSkill.findMany.mockResolvedValue([]);

      const result = await service.update('task-1', { columnId: 'col-1' }, 'user-1');
      expect(prisma.taskColumn.upsert).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes task when found', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', name: 'Task 1' });
      prisma.task.delete.mockResolvedValue({ id: 'task-1' });
      await service.remove('task-1', 'user-1');
    });

    it('throws NotFoundException when task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.remove('task-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setCompleted', () => {
    it('completes task and creates notification', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Task 1',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        })
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Task 1',
          agent: null,
          columnAssignment: null,
          completedAt: new Date(),
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        });
      prisma.task.update.mockResolvedValue({ id: 'task-1', completedAt: new Date() });
      prisma.message.findMany.mockResolvedValue([]);
      const result = await service.setCompleted('task-1', true, 'user-1');
      expect(result).toHaveProperty('completedAt');
    });

    it('throws NotFoundException when task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.setCompleted('task-1', true, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateColumn', () => {
    it('updates task column', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        name: 'Task 1',
        agent: null,
        columnAssignment: { column: { id: 'col-1', name: 'To Do' } },
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      });
      prisma.kanbanColumn.findUnique.mockResolvedValue({
        id: 'col-2',
        projectId: 'proj-1',
        userId: 'user-1',
        name: 'In Progress',
        agent: null,
      });
      prisma.taskColumn.deleteMany.mockResolvedValue({});
      prisma.taskColumn.create.mockResolvedValue({});
      prisma.task.update.mockResolvedValue({
        id: 'task-1',
        columnAssignment: { column: { id: 'col-2', name: 'In Progress', agent: null } },
      });
      const txMock = {
        task: { update: vi.fn() },
        taskColumn: { deleteMany: vi.fn(), upsert: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return await fn(txMock);
        return Promise.resolve();
      });
      const result = await service.updateColumn('task-1', 'col-2', 'user-1');
      expect(result).toBeDefined();
    });

    it('throws BadRequestException when column not in project', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        name: 'Task 1',
        agent: null,
        columnAssignment: null,
        project: {
          id: 'proj-1',
          name: 'Project 1',
          status: 'active',
          defaultAgentId: 'agent-1',
          defaultModel: 'claude-3',
          createdAt: new Date().toISOString(),
          skills: [],
          kanbanColumns: [],
        },
      });
      prisma.kanbanColumn.findUnique.mockResolvedValue({
        id: 'col-2',
        projectId: 'proj-2',
        userId: 'user-1',
        name: 'In Progress',
      });
      const txMock = {
        task: { update: vi.fn() },
        taskColumn: { deleteMany: vi.fn(), upsert: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return await fn(txMock);
        return Promise.resolve();
      });
      await expect(service.updateColumn('task-1', 'col-2', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reorder', () => {
    it('reorders tasks', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', order: 0, columnAssignment: null },
        { id: 'task-2', order: 1, columnAssignment: null },
      ]);
      // reorder uses tx.task.update, not prisma.task.update directly
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-2', name: 'Task 2', agent: null, columnAssignment: null,
        project: { id: 'proj-1', name: 'Project 1', status: 'active', defaultAgentId: 'agent-1', defaultModel: 'claude-3', createdAt: new Date().toISOString(), skills: [], kanbanColumns: [] },
      });

      await service.reorder('proj-1', [{ id: 'task-2', order: 0, columnId: null }], 'user-1');
      // Inside the transaction, tx.task.update is called, which is mocked via prisma.$transaction
    });

    it('reorders tasks with column changes', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      const col = { id: 'col-1', name: 'To Do', index: 0, projectId: 'proj-1', instructions: '', agentId: null, model: null, createdAt: new Date() };
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', order: 0, columnAssignment: null },
        { id: 'task-2', order: 1, columnAssignment: { columnId: 'col-1', column: col } },
      ]);
      prisma.task.findUnique
        .mockResolvedValueOnce({
          id: 'task-1', name: 'Task 1', agent: null, columnAssignment: { columnId: 'col-1', column: { ...col } },
          project: { id: 'proj-1', name: 'Project 1', status: 'active', defaultAgentId: 'agent-1', defaultModel: 'claude-3', createdAt: new Date().toISOString(), skills: [], kanbanColumns: [] },
        })
        .mockResolvedValueOnce({
          id: 'task-1', name: 'Task 1', agent: null, columnAssignment: { columnId: 'col-1', column: { ...col } },
          project: { id: 'proj-1', name: 'Project 1', status: 'active', defaultAgentId: 'agent-1', defaultModel: 'claude-3', createdAt: new Date().toISOString(), skills: [], kanbanColumns: [] },
        });
      prisma.kanbanColumn.findMany.mockResolvedValue([col]);
      prisma.kanbanColumn.findUnique.mockResolvedValue(col);
      prisma.taskTerminal.findMany.mockResolvedValue([]);
      prisma.message.findMany.mockResolvedValue([]);
      prisma.message.count.mockResolvedValue(0);
      prisma.projectSkill.findMany.mockResolvedValue([]);

      const txMock = {
        task: {
          update: vi.fn(),
        },
        taskColumn: {
          deleteMany: vi.fn(),
          upsert: vi.fn(),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return await fn(txMock);
        return Promise.resolve();
      });

      await service.reorder('proj-1', [
        { id: 'task-1', order: 1, columnId: 'col-1' },
        { id: 'task-2', order: 0, columnId: null },
      ], 'user-1');
    });

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.reorder('proj-1', [{ id: 'task-1', order: 0, columnId: null }], 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when columnIds do not belong to project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', order: 0, columnAssignment: null },
        { id: 'task-2', order: 1, columnAssignment: null },
      ]);
      prisma.kanbanColumn.findMany.mockResolvedValue([{ id: 'col-1' }]);

      await expect(
        service.reorder('proj-1', [{ id: 'task-1', order: 0, columnId: 'col-1' }, { id: 'task-2', order: 1, columnId: 'col-2' }], 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByTerminal', () => {
    it('returns tasks for terminal', async () => {
      prisma.taskTerminal.findMany.mockResolvedValue([
        {
          task: {
            id: 'task-1',
            name: 'Task 1',
            userId: 'user-1',
            columnAssignment: { column: { id: 'col-1', name: 'To Do', createdAt: new Date() } },
            project: {
              id: 'proj-1',
              name: 'Project 1',
              defaultAgent: null,
              skills: [],
              kanbanColumns: [],
              createdAt: new Date(),
            },
            agent: null,
          },
        },
      ]);
      prisma.projectSkill.findMany.mockResolvedValue([]);
      const result = await service.findByTerminal('term-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('returns empty array when no assignments', async () => {
      prisma.taskTerminal.findMany.mockResolvedValue([]);
      const result = await service.findByTerminal('term-1');
      expect(result).toHaveLength(0);
    });

    it('handles null columnAssignment and column agent in findByTerminal', async () => {
      prisma.taskTerminal.findMany.mockResolvedValue([
        {
          task: {
            id: 'task-1',
            name: 'Task 1',
            userId: 'user-1',
            columnAssignment: null,
            project: {
              id: 'proj-1',
              name: 'Project 1',
              defaultAgent: null,
              skills: [],
              kanbanColumns: [],
              createdAt: new Date(),
            },
            agent: { id: 'agent-1', name: 'Claude', tag: 'ClaudeCode' },
          },
        },
      ]);
      prisma.projectSkill.findMany.mockResolvedValue([]);
      const result = await service.findByTerminal('term-1');
      expect(result).toHaveLength(1);
      expect(result[0].column).toBeNull();
    });

    it('maps column agent in findByTerminal', async () => {
      prisma.taskTerminal.findMany.mockResolvedValue([
        {
          task: {
            id: 'task-1',
            name: 'Task 1',
            userId: 'user-1',
            columnAssignment: {
              column: {
                id: 'col-1',
                name: 'To Do',
                createdAt: new Date(),
                agent: { id: 'agent-2', name: 'GPT', tag: 'GPT4' },
              },
            },
            project: {
              id: 'proj-1',
              name: 'Project 1',
              defaultAgent: null,
              skills: [],
              kanbanColumns: [],
              createdAt: new Date(),
            },
            agent: null,
          },
        },
      ]);
      prisma.projectSkill.findMany.mockResolvedValue([]);
      const result = await service.findByTerminal('term-1');
      expect(result).toHaveLength(1);
      expect(result[0].column?.agent).toBeDefined();
    });

    it('maps kanbanColumns in project', async () => {
      prisma.taskTerminal.findMany.mockResolvedValue([
        {
          task: {
            id: 'task-1',
            name: 'Task 1',
            userId: 'user-1',
            columnAssignment: null,
            project: {
              id: 'proj-1',
              name: 'Project 1',
              defaultAgent: null,
              skills: [],
              kanbanColumns: [
                { id: 'col-1', name: 'To Do', createdAt: new Date() },
                { id: 'col-2', name: 'Done', createdAt: new Date() },
              ],
              createdAt: new Date(),
            },
            agent: null,
          },
        },
      ]);
      prisma.projectSkill.findMany.mockResolvedValue([]);
      const result = await service.findByTerminal('term-1');
      expect(result).toHaveLength(1);
      expect(result[0].project.kanbanColumns).toHaveLength(2);
    });
  });

  describe('assignTerminal', () => {
    it('assigns terminal to task', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Task 1',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        })
        .mockResolvedValueOnce({
          id: 'task-1',
          name: 'Task 1',
          agent: null,
          columnAssignment: null,
          project: {
            id: 'proj-1',
            name: 'Project 1',
            status: 'active',
            defaultAgentId: 'agent-1',
            defaultModel: 'claude-3',
            createdAt: new Date().toISOString(),
            skills: [],
            kanbanColumns: [],
          },
        });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1', userId: 'user-1' });
      prisma.taskTerminal.upsert.mockResolvedValue({ id: 'tt-1' });
      prisma.taskTerminal.findMany.mockResolvedValue([]);
      prisma.message.findMany.mockResolvedValue([]);
      prisma.message.count.mockResolvedValue(0);
      prisma.projectSkill.findMany.mockResolvedValue([]);

      const result = await service.assignTerminal('task-1', 'term-1', 'user-1');
      expect(result.id).toBe('task-1');
      expect(terminalRegistry.evictTaskTerminal).toHaveBeenCalledWith('task-1');
      expect(terminalRegistry.assignTask).toHaveBeenCalled();
    });

    it('throws NotFoundException when task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.assignTerminal('task-1', 'term-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
