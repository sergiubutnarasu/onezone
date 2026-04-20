import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, data: { name: string; description?: string }) {
    const task = await this.prisma.task.create({
      data: { ...data, projectId },
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    return task;
  }

  async findAllByProject(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string) {
    await this.findOne(id);
    const task = await this.prisma.task.delete({ where: { id } });
    this.logger.log(`Deleted task ${id}`);
    return task;
  }
}
