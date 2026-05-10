import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ColumnOrderItemDto } from './kanban-columns.dto';
import { randomUUID } from 'node:crypto';

export const DEFAULT_KANBAN_COLUMNS = [
  { name: 'In Progress', description: 'Tasks currently being worked on', index: 0 },
  { name: 'Testing', description: 'Tasks being tested or verified', index: 1 },
  { name: 'In Review', description: 'Tasks awaiting code review', index: 2 },
  { name: 'Done', description: 'Completed tasks', index: 3 },
];

@Injectable()
export class KanbanColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProject(projectId: string) {
    return this.prisma.kanbanColumn.findMany({
      where: { projectId },
      orderBy: { index: 'asc' },
    });
  }

  async findOne(id: string) {
    const column = await this.prisma.kanbanColumn.findUnique({ where: { id } });
    if (!column) throw new NotFoundException(`KanbanColumn ${id} not found`);
    return column;
  }

  async create(projectId: string, data: { name: string; description?: string }) {
    const maxIndex = await this.prisma.kanbanColumn.aggregate({
      where: { projectId },
      _max: { index: true },
    });
    const nextIndex = (maxIndex._max.index ?? -1) + 1;
    return this.prisma.kanbanColumn.create({
      data: { projectId, name: data.name, description: data.description, index: nextIndex },
    });
  }

  async createDefaults(projectId: string) {
    await this.prisma.kanbanColumn.createMany({
      data: DEFAULT_KANBAN_COLUMNS.map((col) => ({
        id: randomUUID(),
        projectId,
        ...col,
      })),
    });
    return this.findAllByProject(projectId);
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const existing = await this.prisma.kanbanColumn.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`KanbanColumn ${id} not found`);
    return this.prisma.kanbanColumn.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.kanbanColumn.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`KanbanColumn ${id} not found`);
    // When a column is deleted, task_columns cascade-delete, moving tasks to backlog.
    await this.prisma.kanbanColumn.delete({ where: { id } });
  }

  async reorder(projectId: string, items: ColumnOrderItemDto[]) {
    const existing = await this.prisma.kanbanColumn.findMany({
      where: { id: { in: items.map((i) => i.id) }, projectId },
      select: { id: true },
    });
    const validIds = new Set(existing.map((c) => c.id));
    const validItems = items.filter((i) => validIds.has(i.id));

    await this.prisma.$transaction(
      validItems.map((item) =>
        this.prisma.kanbanColumn.update({
          where: { id: item.id },
          data: { index: item.index },
        }),
      ),
    );

    return this.findAllByProject(projectId);
  }
}
