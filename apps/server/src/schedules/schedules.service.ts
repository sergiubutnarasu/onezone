import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';

@Injectable()
export class SchedulesService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const schedules = await this.prisma.taskSchedule.findMany({
      where: { enabled: true },
    });
    for (const s of schedules) {
      try {
        this.registerCronJob(
          s.id,
          s.cronExpression,
          s.timezone ?? undefined,
        );
      } catch (err) {
        this.logger.error(
          `Failed to register schedule ${s.id} (${s.cronExpression}): ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`Registered ${this.registry.getCronJobs().size} schedule(s) on boot`);
  }

  private jobName(id: string) {
    return `schedule:${id}`;
  }

  private validateCron(expr: string, timezone?: string) {
    try {
      // Construct ephemerally to validate; do not start.
      const job = new CronJob(expr, () => {}, null, false, timezone);
      job.stop();
    } catch (err) {
      throw new BadRequestException(
        `Invalid cron expression: ${(err as Error).message}`,
      );
    }
  }

  private registerCronJob(id: string, expr: string, timezone?: string) {
    const name = this.jobName(id);
    if (this.registry.doesExist('cron', name)) {
      const existing = this.registry.getCronJob(name);
      existing.stop();
      this.registry.deleteCronJob(name);
    }
    const job = new CronJob(
      expr,
      () => {
        this.fire(id).catch((err) =>
          this.logger.error(
            `Schedule ${id} run failed: ${(err as Error).message}`,
          ),
        );
      },
      null,
      false,
      timezone,
    );
    this.registry.addCronJob(name, job);
    job.start();
  }

  private unregisterCronJob(id: string) {
    const name = this.jobName(id);
    if (this.registry.doesExist('cron', name)) {
      const job = this.registry.getCronJob(name);
      job.stop();
      this.registry.deleteCronJob(name);
    }
  }

  private async fire(id: string) {
    const schedule = await this.prisma.taskSchedule.findUnique({
      where: { id },
    });
    if (!schedule || !schedule.enabled) {
      this.unregisterCronJob(id);
      return;
    }
    this.logger.log(`Firing schedule ${id} (${schedule.name})`);
    const taskName = `${schedule.name} #${schedule.runCount + 1}`;
    await this.tasksService.create(schedule.projectId, {
      name: taskName,
      description: schedule.description ?? undefined,
      terminalId: schedule.terminalId,
      agentId: schedule.agentId,
      model: schedule.model,
      useTaskAgentAndModel: schedule.useScheduleAgentAndModel,
      userId: schedule.userId,
      columnId: schedule.startColumnId,
    });
    const next = await this.prisma.taskSchedule.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        ...(schedule.runOnce ? { enabled: false } : {}),
      },
    });
    if (!next.enabled) {
      this.unregisterCronJob(id);
    }
  }

  async findAllByProject(projectId: string, userId: string) {
    return this.prisma.taskSchedule.findMany({
      where: { projectId, userId },
      include: {
        startColumn: { select: { id: true, name: true } },
        terminal: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true, tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const schedule = await this.prisma.taskSchedule.findUnique({
      where: { id },
      include: {
        startColumn: { select: { id: true, name: true } },
        terminal: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true, tag: true } },
      },
    });
    if (!schedule || schedule.userId !== userId) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }
    return schedule;
  }

  async create(projectId: string, data: CreateScheduleDto, userId: string) {
    this.validateCron(data.cronExpression, data.timezone);
    const column = await this.prisma.kanbanColumn.findUnique({
      where: { id: data.startColumnId },
      select: { projectId: true },
    });
    if (!column || column.projectId !== projectId) {
      throw new BadRequestException('startColumnId does not belong to project');
    }
    const schedule = await this.prisma.taskSchedule.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        cronExpression: data.cronExpression,
        timezone: data.timezone,
        startColumnId: data.startColumnId,
        terminalId: data.terminalId,
        agentId: data.agentId,
        model: data.model,
        useScheduleAgentAndModel: data.useScheduleAgentAndModel ?? false,
        enabled: data.enabled ?? true,
        runOnce: data.runOnce ?? false,
        userId,
      },
    });
    this.logger.log(`Created schedule ${schedule.id} for project ${projectId}`);
    if (schedule.enabled) {
      this.registerCronJob(
        schedule.id,
        schedule.cronExpression,
        schedule.timezone ?? undefined,
      );
    }
    return this.findOne(schedule.id, userId);
  }

  async update(id: string, data: UpdateScheduleDto, userId: string) {
    const existing = await this.findOne(id, userId);
    if (data.cronExpression !== undefined) {
      this.validateCron(
        data.cronExpression,
        data.timezone ?? existing.timezone ?? undefined,
      );
    }
    if (data.startColumnId && data.startColumnId !== existing.startColumnId) {
      const column = await this.prisma.kanbanColumn.findUnique({
        where: { id: data.startColumnId },
        select: { projectId: true },
      });
      if (!column || column.projectId !== existing.projectId) {
        throw new BadRequestException(
          'startColumnId does not belong to project',
        );
      }
    }
    const updated = await this.prisma.taskSchedule.update({
      where: { id },
      data,
    });
    this.unregisterCronJob(id);
    if (updated.enabled) {
      this.registerCronJob(
        updated.id,
        updated.cronExpression,
        updated.timezone ?? undefined,
      );
    }
    this.logger.log(`Updated schedule ${id}`);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    this.unregisterCronJob(id);
    await this.prisma.taskSchedule.delete({ where: { id } });
    this.logger.log(`Deleted schedule ${id}`);
  }

  async runNow(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.fire(id);
    return this.findOne(id, userId);
  }
}
