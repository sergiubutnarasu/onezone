import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TaskOrderItemDto } from './tasks.dto';
import { TerminalRegistryService } from '../gateways/terminal-registry.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly terminalRegistry: TerminalRegistryService,
  ) {}

  private flattenTask<T extends { terminalAssignment: { terminal: unknown; assignedAt: unknown } | null }>(
    task: T,
  ) {
    const { terminalAssignment, ...rest } = task;
    return { ...rest, terminal: terminalAssignment?.terminal ?? null };
  }

  async create(projectId: string, data: { name: string; description?: string; terminalId: string; agentId: string; model: string }) {
    const count = await this.prisma.task.count({ where: { projectId, status: 'BACKLOG' } });
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: { name: data.name, description: data.description, agentId: data.agentId, model: data.model, projectId, order: count },
      });
      await tx.taskTerminal.create({ data: { taskId: created.id, terminalId: data.terminalId } });
      return tx.task.findUniqueOrThrow({ where: { id: created.id }, include: { terminalAssignment: { include: { terminal: true } }, agent: true } });
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    this.terminalRegistry.assignTask(data.terminalId, task.id);
    return this.flattenTask(task);
  }

  async findAllByProject(projectId: string, status?: TaskStatus[]) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId, ...(status && status.length > 0 ? { status: { in: status } } : {}) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { terminalAssignment: { include: { terminal: true } }, agent: true },
    });
    return tasks.map((t) => this.flattenTask(t));
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { terminalAssignment: { include: { terminal: true } }, project: { include: { defaultAgent: true } }, agent: true },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.flattenTask(task);
  }

  async updateStatus(id: string, status: TaskStatus) {
    await this.findOne(id);
    const task = await this.prisma.task.update({ where: { id }, data: { status } });
    this.logger.log(`Updated task ${id} status to ${status}`);
    return task;
  }

  async reorder(projectId: string, items: TaskOrderItemDto[]) {
    const existing = await this.prisma.task.findMany({
      where: { id: { in: items.map((i) => i.id) }, projectId },
      select: { id: true },
    });
    const validIds = new Set(existing.map((t) => t.id));
    const validItems = items.filter((i) => validIds.has(i.id));

    await this.prisma.$transaction(
      validItems.map((item) =>
        this.prisma.task.update({
          where: { id: item.id },
          data: { status: item.status, order: item.order },
        }),
      ),
    );

    this.logger.log(`Reordered ${validItems.length} tasks for project ${projectId}`);
    return this.findAllByProject(projectId);
  }

  async remove(id: string) {
    await this.findOne(id);
    this.terminalRegistry.cleanupTaskRoom(id);
    const task = await this.prisma.task.delete({ where: { id } });
    this.logger.log(`Deleted task ${id}`);
    return task;
  }

  async findByTerminal(terminalId: string) {
    const assignments = await this.prisma.taskTerminal.findMany({
      where: { terminalId },
      select: { taskId: true },
    });
    return assignments.map((a) => ({ id: a.taskId }));
  }

  async assignTerminal(id: string, terminalId: string) {
    await this.findOne(id);
    await this.prisma.taskTerminal.upsert({
      where: { taskId: id },
      create: { taskId: id, terminalId },
      update: { terminalId, assignedAt: new Date() },
    });
    this.logger.log(`Assigned terminal ${terminalId} to task ${id}`);
    this.terminalRegistry.evictTaskTerminal(id);
    this.terminalRegistry.assignTask(terminalId, id);
    return this.findOne(id);
  }

  async update(id: string, data: { name?: string; description?: string; status?: TaskStatus; agentId?: string; model?: string }) {
    await this.findOne(id);
    const task = await this.prisma.task.update({
      where: { id },
      data,
    });
    this.logger.log(`Updated task ${id}`);
    return task;
  }
}
