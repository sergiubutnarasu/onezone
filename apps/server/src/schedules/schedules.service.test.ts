import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchedulesService } from './schedules.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BadRequestException, NotFoundException } from '@nestjs/common';

vi.mock('cron', () => ({
  CronJob: vi.fn().mockImplementation((expr: string, onTick: () => void, _onComplete, start, timezone) => {
    if (expr === 'invalid') throw new Error('Invalid cron expression');
    return {
      expr,
      onTick,
      start: vi.fn(),
      stop: vi.fn(),
      running: false,
      timezone,
      getNextRun: vi.fn().mockReturnValue(new Date('2025-01-01')),
    };
  }),
}));

const createMockPrisma = () =>
  ({
    taskSchedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    terminal: {
      findUnique: vi.fn(),
    },
    kanbanColumn: {
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService);

const createMockTasksService = () =>
  ({
    create: vi.fn(),
  } as unknown as TasksService);

const createMockSchedulerRegistry = () => {
  const cronJobs = new Map<string, unknown>();
  return {
    getCronJobs: vi.fn().mockReturnValue(cronJobs),
    addCronJob: vi.fn().mockImplementation((name, job) => {
      cronJobs.set(name, job);
    }),
    deleteCronJob: vi.fn().mockImplementation((name) => {
      cronJobs.delete(name);
    }),
    getCronJob: vi.fn().mockImplementation((name) => {
      const job = cronJobs.get(name);
      if (!job) throw new Error('Cron job not found');
      return job;
    }),
    doesExist: vi.fn().mockImplementation((type, name) => {
      if (type === 'cron') return cronJobs.has(name);
      return false;
    }),
  } as unknown as SchedulerRegistry;
};

describe('SchedulesService', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tasksService: ReturnType<typeof createMockTasksService>;
  let schedulerRegistry: ReturnType<typeof createMockSchedulerRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    tasksService = createMockTasksService();
    schedulerRegistry = createMockSchedulerRegistry();
    service = new SchedulesService(prisma, tasksService, schedulerRegistry);
  });

  describe('onModuleInit', () => {
    it('registers enabled schedules on boot', async () => {
      prisma.taskSchedule.findMany.mockResolvedValue([
        { id: 'sched-1', cronExpression: '0 9 * * *', enabled: true },
        { id: 'sched-2', cronExpression: '0 10 * * *', enabled: true },
      ]);
      await service.onModuleInit();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(2);
    });

    it('handles errors when registering schedules', async () => {
      prisma.taskSchedule.findMany.mockResolvedValue([
        { id: 'sched-1', cronExpression: 'invalid', enabled: true },
      ]);
      await service.onModuleInit();
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('findAllByProject', () => {
    it('returns schedules for project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.taskSchedule.findMany.mockResolvedValue([
        { id: 'sched-1', name: 'Daily Task' },
      ]);
      const result = await service.findAllByProject('proj-1', 'user-1');
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findAllByProject('proj-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns schedule when found and owned', async () => {
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        name: 'Daily Task',
      });
      const result = await service.findOne('sched-1', 'user-1');
      expect(result.id).toBe('sched-1');
    });

    it('throws NotFoundException when schedule not owned', async () => {
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-2',
        name: 'Daily Task',
      });
      await expect(service.findOne('sched-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when schedule not found', async () => {
      prisma.taskSchedule.findUnique.mockResolvedValue(null);
      await expect(service.findOne('sched-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates enabled schedule', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1' });
      prisma.kanbanColumn.findUnique.mockResolvedValue({
        id: 'col-1',
        projectId: 'proj-1',
        userId: 'user-1',
      });
      prisma.taskSchedule.create.mockResolvedValue({
        id: 'sched-1',
        enabled: true,
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
      });
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        name: 'Daily',
      });

      const result = await service.create('proj-1', {
        name: 'Daily',
        description: 'Daily task',
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
        startColumnId: 'col-1',
        terminalId: 'term-1',
        agentId: 'agent-1',
        model: 'claude-3',
        useScheduleAgentAndModel: false,
        bypass: false,
        enabled: true,
        runOnce: false,
      }, 'user-1');

      expect(result).toHaveProperty('id', 'sched-1');
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });

    it('throws BadRequestException when column does not belong to project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1' });
      prisma.kanbanColumn.findUnique.mockResolvedValue({
        id: 'col-1',
        projectId: 'proj-2',
        userId: 'user-1',
      });

      await expect(
        service.create('proj-1', {
          name: 'Daily',
          description: '',
          cronExpression: '0 9 * * *',
          startColumnId: 'col-1',
          terminalId: 'term-1',
        } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates schedule and re-registers cron job', async () => {
      // Pre-register existing cron job so unregister deletes it
      schedulerRegistry.addCronJob('schedule:sched-1', { stop: vi.fn() } as any);
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        projectId: 'proj-1',
        startColumnId: 'col-1',
        enabled: true,
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
      });
      prisma.taskSchedule.update.mockResolvedValue({
        id: 'sched-1',
        enabled: true,
        cronExpression: '0 10 * * *',
        timezone: 'UTC',
      });

      const result = await service.update('sched-1', {
        cronExpression: '0 10 * * *',
        timezone: 'UTC',
      }, 'user-1');

      expect(result).toBeDefined();
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalled();
    });

    it('throws BadRequestException when updating startColumnId to invalid column', async () => {
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        projectId: 'proj-1',
        startColumnId: 'col-1',
        enabled: true,
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
      });
      prisma.kanbanColumn.findUnique.mockResolvedValue({
        id: 'col-2',
        projectId: 'proj-2',
        userId: 'user-1',
      });

      await expect(
        service.update('sched-1', { startColumnId: 'col-2' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes schedule and unregisters cron job', async () => {
      schedulerRegistry.addCronJob('schedule:sched-1', { stop: vi.fn() } as any);
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
      });
      await service.remove('sched-1', 'user-1');
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalled();
      expect(prisma.taskSchedule.delete).toHaveBeenCalledWith({ where: { id: 'sched-1' } });
    });
  });

  describe('runNow', () => {
    it('fires schedule immediately', async () => {
      prisma.taskSchedule.findUnique
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Daily',
          enabled: true,
          runCount: 0,
          runOnce: false,
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Daily',
          enabled: true,
          runCount: 0,
          runOnce: false,
          projectId: 'proj-1',
          terminalId: 'term-1',
        })
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Daily',
        });
      prisma.taskSchedule.update.mockResolvedValue({ id: 'sched-1', runCount: 1, enabled: true });

      await service.runNow('sched-1', 'user-1');
      expect(tasksService.create).toHaveBeenCalled();
    });

    it('unregisters cron job when runOnce schedule fires', async () => {
      prisma.taskSchedule.findUnique
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Once',
          enabled: true,
          runCount: 0,
          runOnce: true,
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Once',
          enabled: true,
          runCount: 0,
          runOnce: true,
          projectId: 'proj-1',
          terminalId: 'term-1',
        })
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Once',
        });
      prisma.taskSchedule.update.mockResolvedValue({ id: 'sched-1', runCount: 1, enabled: false });
      schedulerRegistry.addCronJob('schedule:sched-1', { stop: vi.fn() } as any);

      await service.runNow('sched-1', 'user-1');
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('calls ensureTerminalOwned when terminalId is provided', async () => {
      schedulerRegistry.addCronJob('schedule:sched-1', { stop: vi.fn() } as any);
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        projectId: 'proj-1',
        startColumnId: 'col-1',
        enabled: true,
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
      });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1', userId: 'user-1' });
      prisma.taskSchedule.update.mockResolvedValue({
        id: 'sched-1',
        enabled: true,
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
      });

      await service.update('sched-1', { terminalId: 'term-1' }, 'user-1');
      expect(prisma.terminal.findUnique).toHaveBeenCalledWith({ where: { id: 'term-1', userId: 'user-1' } });
    });
  });
});
