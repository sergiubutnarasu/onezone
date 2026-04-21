import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TaskOrderItemDto } from './tasks.dto';
import { AgentRegistryService } from '../gateways/agent-registry.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  async create(projectId: string, data: { name: string; description?: string; agentId?: string }) {
    const count = await this.prisma.task.count({ where: { projectId, status: 'BACKLOG' } });
    const task = await this.prisma.task.create({
      data: { ...data, projectId, order: count },
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    if (data.agentId) {
      this.agentRegistry.assignTask(data.agentId, task.id);
    }
    return task;
  }

  async findAllByProject(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
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
    const task = await this.prisma.task.delete({ where: { id } });
    this.logger.log(`Deleted task ${id}`);
    return task;
  }

  async findByAgent(agentId: string) {
    return this.prisma.task.findMany({
      where: { agentId },
      select: { id: true },
    });
  }

  async assignAgent(id: string, agentId: string | null) {
    await this.findOne(id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { agentId },
    });
    this.logger.log(`Assigned agent ${agentId} to task ${id}`);
    // Evict whatever agent is currently in the task room before notifying the new one.
    this.agentRegistry.evictTaskAgent(id);
    if (agentId) {
      this.agentRegistry.assignTask(agentId, id);
    }
    return task;
  }
}
