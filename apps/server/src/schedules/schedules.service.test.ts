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

    it('replaces an already-registered cron job for the same schedule id', async () => {
      prisma.taskSchedule.findMany.mockResolvedValue([
        { id: 'sched-1', cronExpression: '0 9 * * *', enabled: true },
        { id: 'sched-1', cronExpression: '0 10 * * *', enabled: true },
      ]);
      await service.onModuleInit();
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith('schedule:sched-1');
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(2);
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

    it('registered cron job calls fire() on tick and logs on failure', async () => {
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

      await service.create('proj-1', {
        name: 'Daily',
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
        startColumnId: 'col-1',
        terminalId: 'term-1',
      } as any, 'user-1');

      const job = schedulerRegistry.getCronJob('schedule:sched-1') as any;
      const fireSpy = vi.spyOn(service as any, 'fire').mockRejectedValue(new Error('boom'));
      job.onTick();
      expect(fireSpy).toHaveBeenCalledWith('sched-1');
      await Promise.resolve();
      await Promise.resolve();
    });

    it('applies defaults for optional flags and timezone when omitted', async () => {
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
      });
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        name: 'Daily',
      });

      await service.create('proj-1', {
        name: 'Daily',
        description: 'Daily task',
        cronExpression: '0 9 * * *',
        startColumnId: 'col-1',
        terminalId: 'term-1',
      } as any, 'user-1');

      expect(prisma.taskSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            useScheduleAgentAndModel: false,
            bypass: false,
            enabled: true,
            runOnce: false,
          }),
        }),
      );
    });

    it('throws NotFoundException when terminal is not owned', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.terminal.findUnique.mockResolvedValue(null);

      await expect(
        service.create('proj-1', {
          name: 'Daily',
          cronExpression: '0 9 * * *',
          startColumnId: 'col-1',
          terminalId: 'missing-term',
        } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an invalid cron expression', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.terminal.findUnique.mockResolvedValue({ id: 'term-1' });

      await expect(
        service.create('proj-1', {
          name: 'Daily',
          cronExpression: 'invalid',
          startColumnId: 'col-1',
          terminalId: 'term-1',
        } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
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

    it('updates startColumnId when the new column belongs to the project', async () => {
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
        projectId: 'proj-1',
        userId: 'user-1',
      });
      prisma.taskSchedule.update.mockResolvedValue({
        id: 'sched-1',
        enabled: true,
        cronExpression: '0 9 * * *',
      });

      const result = await service.update('sched-1', { startColumnId: 'col-2' }, 'user-1');
      expect(result).toBeDefined();
    });

    it('falls back to the existing timezone when validating an updated cron expression without one', async () => {
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
      });

      const result = await service.update('sched-1', { cronExpression: '0 10 * * *' }, 'user-1');
      expect(result).toBeDefined();
    });

    it('registers the cron job without a timezone when neither schedule has one', async () => {
      prisma.taskSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        userId: 'user-1',
        projectId: 'proj-1',
        startColumnId: 'col-1',
        enabled: true,
        cronExpression: '0 9 * * *',
      });
      prisma.taskSchedule.update.mockResolvedValue({
        id: 'sched-1',
        enabled: true,
        cronExpression: '0 10 * * *',
      });

      const result = await service.update('sched-1', { cronExpression: '0 10 * * *' }, 'user-1');
      expect(result).toBeDefined();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
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

    it('does not create a task and unregisters the cron job when the schedule is disabled by the time it fires', async () => {
      schedulerRegistry.addCronJob('schedule:sched-1', { stop: vi.fn() } as any);
      prisma.taskSchedule.findUnique
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Daily',
          enabled: true,
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'sched-1',
          userId: 'user-1',
          name: 'Daily',
        });

      await service.runNow('sched-1', 'user-1');
      expect(tasksService.create).not.toHaveBeenCalled();
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith('schedule:sched-1');
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
