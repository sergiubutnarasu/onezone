import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ColumnOrderItemDto } from "./kanban-columns.dto";
import { randomUUID } from "node:crypto";
import { DEFAULT_KANBAN_COLUMNS } from "./constants";

@Injectable()
export class KanbanColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProject(projectId: string, userId?: string) {
    return this.prisma.kanbanColumn.findMany({
      where: userId ? { projectId, userId } : { projectId },
      orderBy: { index: "asc" },
    });
  }

  async findOne(id: string, projectId?: string, userId?: string) {
    const column = await this.prisma.kanbanColumn.findUnique({ where: { id } });
    if (!column || (projectId && column.projectId !== projectId) || (userId && column.userId !== userId)) {
      throw new NotFoundException(`KanbanColumn ${id} not found`);
    }
    return column;
  }

  async create(
    projectId: string,
    data: { name: string; instructions?: string; agentId?: string | null; model?: string | null },
    userId: string,
  ) {
    const maxIndex = await this.prisma.kanbanColumn.aggregate({
      where: { projectId },
      _max: { index: true },
    });
    const nextIndex = (maxIndex._max.index ?? -1) + 1;
    return this.prisma.kanbanColumn.create({
      data: {
        projectId,
        name: data.name,
        instructions: data.instructions,
        index: nextIndex,
        agentId: data.agentId ?? null,
        model: data.model ?? null,
        userId,
      },
    });
  }

  async createDefaults(projectId: string, userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await client.kanbanColumn.createMany({
      data: DEFAULT_KANBAN_COLUMNS.map((col) => ({
        id: randomUUID(),
        projectId,
        userId,
        ...col,
      })),
    });
    return this.findAllByProject(projectId, userId);
  }

  async update(
    id: string,
    data: { name?: string; instructions?: string; agentId?: string | null; model?: string | null },
    projectId?: string,
    userId?: string,
  ) {
    await this.findOne(id, projectId, userId);
    const updateData: {
      name?: string;
      instructions?: string;
      agentId?: string | null;
      model?: string | null;
    } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.agentId !== undefined) updateData.agentId = data.agentId;
    if (data.model !== undefined) updateData.model = data.model;
    return this.prisma.kanbanColumn.update({ where: { id }, data: updateData });
  }

  async remove(id: string, projectId?: string, userId?: string) {
    await this.findOne(id, projectId, userId);
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
