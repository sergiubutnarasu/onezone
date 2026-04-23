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

  async create(projectId: string, data: { name: string; description?: string; terminalId: string }) {
    const count = await this.prisma.task.count({ where: { projectId, status: 'BACKLOG' } });
    const task = await this.prisma.task.create({
      data: { ...data, projectId, order: count },
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    this.terminalRegistry.assignTask(data.terminalId, task.id);
    return task;
  }

  async findAllByProject(projectId: string, status?: TaskStatus[]) {
    return this.prisma.task.findMany({
      where: { projectId, ...(status && status.length > 0 ? { status: { in: status } } : {}) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { terminal: true },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: { terminal: true } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
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
    return this.prisma.task.findMany({
      where: { terminalId },
      select: { id: true },
    });
  }

  async assignTerminal(id: string, terminalId: string) {
    await this.findOne(id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { terminalId },
    });
    this.logger.log(`Assigned terminal ${terminalId} to task ${id}`);
    this.terminalRegistry.evictTaskTerminal(id);
    this.terminalRegistry.assignTask(terminalId, id);
    return task;
  }
}
