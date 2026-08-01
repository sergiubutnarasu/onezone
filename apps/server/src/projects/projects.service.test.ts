import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsService } from './projects.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TerminalRegistryService } from '../gateways/terminal-registry.service.js';
import { KanbanColumnsService } from './kanban-columns.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';

const createMockPrisma = () =>
  ({
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    projectSkill: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
    agent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    kanbanColumn: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    taskColumn: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    taskTerminal: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  } as unknown as PrismaService);

const createMockTerminalRegistry = () =>
  ({
    stopProjectBuilderCommand: vi.fn().mockReturnValue(true),
    cleanupTaskRoom: vi.fn(),
    notifyProjectBuilderCommandFinished: vi.fn(),
  } as unknown as TerminalRegistryService);

const createMockKanbanColumns = () =>
  ({
    createDefaults: vi.fn(),
  } as unknown as KanbanColumnsService);

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let terminalRegistry: ReturnType<typeof createMockTerminalRegistry>;
  let kanbanColumnsService: ReturnType<typeof createMockKanbanColumns>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    terminalRegistry = createMockTerminalRegistry();
    kanbanColumnsService = createMockKanbanColumns();
    service = new ProjectsService(prisma, terminalRegistry, kanbanColumnsService);
  });

  describe('create', () => {
    it('creates a project with default kanban columns', async () => {
      const data = {
        name: 'Test Project',
        description: 'A test project',
        repository: 'https://github.com/test',
        defaultAgentId: 'agent-1',
        defaultModel: 'claude-3',
        userId: 'user-1',
      };
      prisma.project.create.mockResolvedValue({ id: 'proj-1', ...data });
      const result = await service.create(data);
      expect(result).toHaveProperty('id', 'proj-1');
      expect(kanbanColumnsService.createDefaults).toHaveBeenCalledWith('proj-1', 'user-1');
    });
  });

  describe('createPending', () => {
    it('creates a project with pending status', async () => {
      const data = {
        name: 'Pending Project',
        defaultAgentId: 'agent-1',
        defaultModel: 'claude-3',
        userId: 'user-1',
      };
      prisma.project.create.mockResolvedValue({ id: 'proj-1', status: 'pending', ...data });
      const result = await service.createPending(data);
      expect(result.status).toBe('pending');
    });
  });

  describe('findAll', () => {
    it('returns projects for user with skills', async () => {
      prisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Project 1', skills: [{ id: 's1', skillName: 'react' }] },
      ]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].skills).toHaveLength(1);
    });
  });

  describe('getStatistics', () => {
    it('returns project statistics', async () => {
      prisma.project.findMany.mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Project 1',
          tasks: [
            { id: 't1', completedAt: new Date() },
            { id: 't2', completedAt: null },
          ],
        },
      ]);
      prisma.message.findMany.mockResolvedValue([
        {
          exitCode: 0,
          inputTokens: 100,
          outputTokens: 200,
          totalCostUsd: 0.01,
          task: { projectId: 'proj-1' },
        },
        {
          exitCode: 1,
          inputTokens: 50,
          outputTokens: 100,
          totalCostUsd: 0.005,
          task: { projectId: 'proj-1' },
        },
      ]);

      const result = await service.getStatistics('user-1');
      expect(result.totals.tasksDone).toBe(1);
      expect(result.totals.totalTasks).toBe(2);
      expect(result.totals.jobsSucceeded).toBe(1);
      expect(result.totals.jobsFailed).toBe(1);
      expect(result.projects).toHaveLength(1);
    });

    it('returns empty statistics when no projects', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.message.findMany.mockResolvedValue([]);
      const result = await service.getStatistics('user-1');
      expect(result.totals.totalTasks).toBe(0);
      expect(result.projects).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('returns project when found', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Project 1' });
      const result = await service.findOne('proj-1', 'user-1');
      expect(result).toEqual({ id: 'proj-1', name: 'Project 1' });
    });

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findOne('proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates project when found', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Old Name' });
      prisma.project.update.mockResolvedValue({ id: 'proj-1', name: 'New Name' });
      const result = await service.update('proj-1', { name: 'New Name' }, 'user-1');
      expect(result.name).toBe('New Name');
    });
  });

  describe('updateStatus', () => {
    it('updates status and notifies when transitioning to ready', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'pending' });
      prisma.project.update.mockResolvedValue({ id: 'proj-1', status: 'ready' });
      const result = await service.updateStatus('proj-1', 'ready', 'user-1', {
        commandId: 'cmd-1',
        terminalId: 'term-1',
        terminalName: 'Terminal 1',
      });
      expect(result.status).toBe('ready');
      expect(terminalRegistry.notifyProjectBuilderCommandFinished).toHaveBeenCalled();
    });

    it('does not notify when status does not change', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'ready' });
      prisma.project.update.mockResolvedValue({ id: 'proj-1', status: 'ready' });
      await service.updateStatus('proj-1', 'ready', 'user-1');
      expect(terminalRegistry.notifyProjectBuilderCommandFinished).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes project and cleans up tasks', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'ready' });
      prisma.task.findMany.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);
      prisma.project.delete.mockResolvedValue({ id: 'proj-1' });
      const result = await service.remove('proj-1', 'user-1');
      expect(terminalRegistry.cleanupTaskRoom).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('proj-1');
    });

    it('stops builder command for pending projects', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'pending' });
      prisma.task.findMany.mockResolvedValue([]);
      prisma.project.delete.mockResolvedValue({ id: 'proj-1' });
      await service.remove('proj-1', 'user-1');
      expect(terminalRegistry.stopProjectBuilderCommand).toHaveBeenCalledWith('proj-1', {
        projectId: 'proj-1',
      });
    });
  });

  describe('listSkills', () => {
    it('returns skills for project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.projectSkill.findMany.mockResolvedValue([
        { id: 's1', skillName: 'react' },
      ]);
      const result = await service.listSkills('proj-1', 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('installSkill', () => {
    it('installs skill when not already present', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.projectSkill.findUnique.mockResolvedValue(null);
      prisma.projectSkill.create.mockResolvedValue({ id: 's1', skillName: 'react' });
      const result = await service.installSkill('proj-1', { source: 'github', skillName: 'react' }, 'user-1');
      expect(result.skillName).toBe('react');
    });

    it('throws ConflictException when skill already installed', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.projectSkill.findUnique.mockResolvedValue({ id: 's1' });
      await expect(
        service.installSkill('proj-1', { source: 'github', skillName: 'react' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeSkill', () => {
    it('removes skill when found', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.projectSkill.findUnique.mockResolvedValue({ id: 's1', projectId: 'proj-1' });
      await service.removeSkill('proj-1', 's1', 'user-1');
      expect(prisma.projectSkill.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('throws NotFoundException when skill not on project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.projectSkill.findUnique.mockResolvedValue(null);
      await expect(service.removeSkill('proj-1', 's1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listGlobalSkills', () => {
    it('returns global skills for user', async () => {
      prisma.projectSkill.findMany.mockResolvedValue([{ id: 's1', skillName: 'node' }]);
      const result = await service.listGlobalSkills('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('installGlobalSkill', () => {
    it('installs global skill when not already present', async () => {
      prisma.projectSkill.findFirst.mockResolvedValue(null);
      prisma.projectSkill.create.mockResolvedValue({ id: 's1', skillName: 'node' });
      const result = await service.installGlobalSkill({ source: 'npm', skillName: 'node' }, 'user-1');
      expect(result.skillName).toBe('node');
    });

    it('throws ConflictException when global skill already installed', async () => {
      prisma.projectSkill.findFirst.mockResolvedValue({ id: 's1' });
      await expect(
        service.installGlobalSkill({ source: 'npm', skillName: 'node' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeGlobalSkill', () => {
    it('removes global skill when found', async () => {
      prisma.projectSkill.findUnique.mockResolvedValue({
        id: 's1',
        projectId: null,
        userId: 'user-1',
        skillName: 'node',
      });
      await service.removeGlobalSkill('s1', 'user-1');
      expect(prisma.projectSkill.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('throws NotFoundException when global skill not found', async () => {
      prisma.projectSkill.findUnique.mockResolvedValue(null);
      await expect(service.removeGlobalSkill('s1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportConfig', () => {
    it('returns project configuration', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Project 1',
        description: 'desc',
        repository: 'repo',
        defaultModel: 'claude-3',
        defaultAgent: { name: 'Claude' },
        kanbanColumns: [
          { name: 'To Do', instructions: '', agent: null, model: null },
          { name: 'Done', instructions: 'finish', agent: { name: 'Claude' }, model: 'gpt-4' },
        ],
        skills: [{ source: 'npm', skillName: 'node' }],
      });
      const result = await service.exportConfig('proj-1', 'user-1');
      expect(result.version).toBe('1');
      expect(result.columns).toHaveLength(2);
      expect(result.skills).toHaveLength(1);
    });

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.exportConfig('proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('importConfig', () => {
    it('imports project configuration', async () => {
      prisma.agent.findFirst.mockResolvedValueOnce({ id: 'agent-1', name: 'Claude' });
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          ...prisma,
          $transaction: undefined,
          projectSkill: { ...prisma.projectSkill, createMany: vi.fn() },
        };
        return await fn(tx);
      });

      const result = await service.importConfig(
        {
          version: '1',
          name: 'Imported Project',
          defaultAgent: 'Claude',
          defaultModel: 'claude-3',
          columns: [{ name: 'To Do', instructions: 'Some instructions' }],
          skills: [{ source: 'npm', skillName: 'node' }],
        },
        'user-1',
      );
      expect(result).toHaveProperty('id', 'proj-1');
    });

    it('throws NotFoundException when default agent not found', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);
      await expect(
        service.importConfig(
          {
            version: '1',
            name: 'Imported',
            defaultAgent: 'Missing',
            defaultModel: 'claude-3',
            columns: [],
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('imports project with empty columns (calls createDefaults)', async () => {
      prisma.agent.findFirst.mockResolvedValueOnce({ id: 'agent-1', name: 'Claude' });
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          ...prisma,
          $transaction: undefined,
          projectSkill: { ...prisma.projectSkill, createMany: vi.fn() },
        };
        return await fn(tx);
      });

      const result = await service.importConfig(
        {
          version: '1',
          name: 'Imported Project',
          defaultAgent: 'Claude',
          defaultModel: 'claude-3',
          columns: [],
          skills: [],
        },
        'user-1',
      );
      expect(result).toHaveProperty('id', 'proj-1');
      expect(kanbanColumnsService.createDefaults).toHaveBeenCalledWith('proj-1', 'user-1', expect.anything());
    });
  });

  describe('getCostStats', () => {
    it('returns aggregated cost stats', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', userId: 'user-1' });
      prisma.message.aggregate.mockResolvedValue({
        _sum: {
          inputTokens: 100,
          outputTokens: 200,
          totalCostUsd: 0.05,
        },
      });
      const result = await service.getCostStats('proj-1', 'user-1');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(200);
      expect(result.costUsd).toBe(0.05);
    });

    it('returns zeroes when no data', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', userId: 'user-1' });
      prisma.message.aggregate.mockResolvedValue({
        _sum: {
          inputTokens: null,
          outputTokens: null,
          totalCostUsd: null,
        },
      });
      const result = await service.getCostStats('proj-1', 'user-1');
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.costUsd).toBe(0);
    });

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.getCostStats('proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
