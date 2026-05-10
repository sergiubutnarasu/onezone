import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  AgentTag,
  ChatMessage,
  KanbanColumn,
  MessageRole,
  TaskDetails,
} from "@onezone/shared";
import { TerminalRegistryService } from "../gateways/terminal-registry.service";
import { PrismaService } from "../prisma/prisma.service";
import { TaskOrderItemDto } from "./tasks.dto";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly terminalRegistry: TerminalRegistryService,
  ) {}

  private mapToTaskDetails(
    task: {
      id: string;
      name: string;
      description?: string | null;
      agentId: string;
      model: string;
      completedAt?: Date | null;
      agent: { id: string; name: string; tag: string } | null;
      columnAssignment?: {
        column: {
          id: string;
          name: string;
          projectId?: string;
          instructions?: string;
          index?: number;
          createdAt?: string | Date;
        };
      } | null;
    },
    project: {
      id: string;
      name: string;
      description?: string | null;
      repository?: string | null;
      defaultAgentId: string;
      createdAt: string;
      defaultModel: string;
      skills?: { id: string; source: string; skillName: string }[];
      kanbanColumns?: KanbanColumn[];
    },
  ): TaskDetails {
    const raw = task.columnAssignment?.column ?? null;
    const column: KanbanColumn | null = raw
      ? {
          id: raw.id,
          name: raw.name,
          projectId: raw.projectId ?? '',
          instructions: raw.instructions ?? '',
          index: raw.index ?? 0,
          createdAt:
            raw.createdAt instanceof Date
              ? raw.createdAt.toISOString()
              : (raw.createdAt ?? new Date().toISOString()),
        }
      : null;
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      columnId: column?.id ?? null,
      column: column,
      completedAt: task.completedAt?.toISOString() ?? null,
      agentId: task.agentId,
      agent: task.agent
        ? {
            id: task.agent.id,
            name: task.agent.name,
            tag: task.agent.tag as unknown as AgentTag,
          }
        : null,
      model: task.model,
      projectId: project.id,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        repository: project.repository,
        defaultAgentId: project.defaultAgentId,
        defaultModel: project.defaultModel,
        createdAt: project.createdAt,
        skills:
          project.skills?.map((s) => ({
            id: s.id,
            source: s.source,
            skillName: s.skillName,
          })) ?? [],
        kanbanColumns: project.kanbanColumns ?? [],
      },
    };
  }

  private async toChatMessage(
    task: Awaited<ReturnType<typeof this.findOne>>,
    columnOverride?: KanbanColumn | null,
  ): Promise<ChatMessage> {
    const project = task.project!;
    const globalSkills = await this.prisma.projectSkill.findMany({
      where: { projectId: null },
    });
    const kanbanColumns = await this.prisma.kanbanColumn.findMany({
      where: { projectId: project.id },
      orderBy: { index: "asc" },
    });
    const projectWithAllSkills = {
      ...project,
      createdAt: project.createdAt.toISOString(),
      skills: [...(project.skills ?? []), ...globalSkills],
      kanbanColumns: kanbanColumns.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    };
    const taskWithColumnOverride =
      columnOverride !== undefined
        ? {
            ...task,
            columnAssignment: columnOverride
              ? { column: columnOverride }
              : null,
          }
        : task;
    return {
      content: "",
      role: MessageRole.System,
      task: this.mapToTaskDetails(taskWithColumnOverride, projectWithAllSkills),
    };
  }

  private flattenTask<
    T extends {
      terminalAssignment: { terminal: unknown; assignedAt: unknown } | null;
      columnAssignment: {
        column: {
          id: string;
          name: string;
          index: number;
          instructions: string;
        };
        assignedAt: Date;
      } | null;
    },
  >(task: T) {
    const { terminalAssignment, columnAssignment, ...rest } = task;
    return {
      ...rest,
      terminal: terminalAssignment?.terminal ?? null,
      columnId: columnAssignment?.column.id ?? null,
      columnName: columnAssignment?.column.name ?? null,
    };
  }

  async create(
    projectId: string,
    data: {
      name: string;
      description?: string;
      terminalId: string;
      agentId: string;
      model: string;
    },
  ) {
    const count = await this.prisma.task.count({
      where: { projectId, columnAssignment: null },
    });
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          name: data.name,
          description: data.description,
          agentId: data.agentId,
          model: data.model,
          projectId,
          order: count,
        },
      });
      await tx.taskTerminal.create({
        data: { taskId: created.id, terminalId: data.terminalId },
      });
      return tx.task.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          terminalAssignment: { include: { terminal: true } },
          columnAssignment: { include: { column: true } },
          agent: true,
        },
      });
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    const fullTask = await this.findOne(task.id);
    this.terminalRegistry.assignTask(
      data.terminalId,
      (await this.toChatMessage(fullTask)).task!,
    );
    return this.flattenTask(task);
  }

  async findAllByProject(projectId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        terminalAssignment: { include: { terminal: true } },
        columnAssignment: { include: { column: true } },
        agent: true,
      },
    });
    return tasks.map((t) => this.flattenTask(t));
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        terminalAssignment: { include: { terminal: true } },
        columnAssignment: { include: { column: true } },
        project: { include: { skills: true } },
        agent: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.flattenTask(task);
  }

  async findOneDetails(id: string): Promise<TaskDetails> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        columnAssignment: { include: { column: true } },
        project: {
          include: {
            skills: true,
            kanbanColumns: { orderBy: { index: "asc" } },
          },
        },
        agent: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    const globalSkills = await this.prisma.projectSkill.findMany({
      where: { projectId: null },
    });
    const project = task.project;
    const projectWithAllSkills = {
      ...project,
      createdAt: project.createdAt.toISOString(),
      skills: [...(project.skills ?? []), ...globalSkills],
      kanbanColumns: project.kanbanColumns.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    };
    const taskForMap = {
      ...task,
      columnAssignment: task.columnAssignment
        ? {
            ...task.columnAssignment,
            column: {
              ...task.columnAssignment.column,
              createdAt: task.columnAssignment.column.createdAt.toISOString(),
            },
          }
        : null,
    };
    return this.mapToTaskDetails(taskForMap, projectWithAllSkills);
  }

  async updateColumn(id: string, columnId: string | null) {
    const existing = await this.findOne(id);
    let column: KanbanColumn | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (columnId === null) {
        await tx.taskColumn.deleteMany({ where: { taskId: id } });
        await tx.task.update({ where: { id }, data: { completedAt: null } });
      } else {
        const col = await tx.kanbanColumn.findUniqueOrThrow({
          where: { id: columnId },
          select: { id: true, name: true, index: true, projectId: true, instructions: true, createdAt: true },
        });
        column = { ...col, createdAt: col.createdAt.toISOString() };
        const maxIndex = await tx.kanbanColumn.aggregate({
          where: { projectId: existing.projectId },
          _max: { index: true },
        });
        const completedAt =
          col.index === maxIndex._max.index ? new Date() : null;
        await tx.taskColumn.upsert({
          where: { taskId: id },
          create: { taskId: id, columnId },
          update: { columnId, assignedAt: new Date() },
        });
        await tx.task.update({ where: { id }, data: { completedAt } });
      }
    });

    this.logger.log(`Updated task ${id} column to ${columnId ?? "backlog"}`);
    this.terminalRegistry.notifyTaskColumnUpdated(
      id,
      await this.toChatMessage(existing, column),
    );

    return this.findOne(id);
  }

  async reorder(projectId: string, items: TaskOrderItemDto[]) {
    const [existing, projectColumns] = await Promise.all([
      this.prisma.task.findMany({
        where: { id: { in: items.map((i) => i.id) }, projectId },
        include: { columnAssignment: true },
      }),
      this.prisma.kanbanColumn.findMany({
        where: { projectId },
        orderBy: { index: "asc" },
        select: { id: true, index: true },
      }),
    ]);
    const lastColumnId =
      projectColumns.length > 0
        ? projectColumns[projectColumns.length - 1].id
        : null;
    const existingMap = new Map(existing.map((t) => [t.id, t]));
    const validItems = items.filter((i) => existingMap.has(i.id));

    await this.prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        const prev = existingMap.get(item.id)!;
        const prevColumnId = prev.columnAssignment?.columnId ?? null;
        const columnChanged = item.columnId !== prevColumnId;

        const updateData: { order: number; completedAt?: Date | null } = {
          order: item.order,
        };
        if (columnChanged) {
          updateData.completedAt =
            item.columnId === lastColumnId ? new Date() : null;
        }
        await tx.task.update({ where: { id: item.id }, data: updateData });

        if (columnChanged) {
          if (item.columnId === null) {
            await tx.taskColumn.deleteMany({ where: { taskId: item.id } });
          } else {
            await tx.taskColumn.upsert({
              where: { taskId: item.id },
              create: { taskId: item.id, columnId: item.columnId },
              update: { columnId: item.columnId, assignedAt: new Date() },
            });
          }
        }
      }
    });

    // Notify column changes for affected tasks
    for (const item of validItems) {
      const prev = existingMap.get(item.id)!;
      const prevColumnId = prev.columnAssignment?.columnId ?? null;
      if (item.columnId !== prevColumnId) {
        const updated = await this.findOne(item.id);
        let column: KanbanColumn | null = null;
        if (item.columnId) {
          const col = await this.prisma.kanbanColumn.findUnique({
            where: { id: item.columnId },
            select: { id: true, name: true, index: true, projectId: true, instructions: true, createdAt: true },
          });
          column = col ? { ...col, createdAt: col.createdAt.toISOString() } : null;
        }
        this.terminalRegistry.notifyTaskColumnUpdated(
          item.id,
          await this.toChatMessage(updated, column),
        );
      }
    }

    this.logger.log(
      `Reordered ${validItems.length} tasks for project ${projectId}`,
    );
    return this.findAllByProject(projectId);
  }

  async remove(id: string) {
    await this.findOne(id);
    this.terminalRegistry.cleanupTaskRoom(id);
    const task = await this.prisma.task.delete({ where: { id } });
    this.logger.log(`Deleted task ${id}`);
    return task;
  }

  async findByTerminal(terminalId: string): Promise<TaskDetails[]> {
    const [assignments, globalSkills] = await Promise.all([
      this.prisma.taskTerminal.findMany({
        where: { terminalId },
        include: {
          task: {
            include: {
              columnAssignment: { include: { column: true } },
              project: {
                include: {
                  skills: true,
                  kanbanColumns: { orderBy: { index: "asc" } },
                },
              },
              agent: true,
            },
          },
        },
      }),
      this.prisma.projectSkill.findMany({ where: { projectId: null } }),
    ]);
    return assignments.map((a): TaskDetails => {
      const t = a.task;
      const projectWithAllSkills = {
        ...t.project,
        createdAt: t.project.createdAt.toISOString(),
        skills: [...(t.project.skills ?? []), ...globalSkills],
        kanbanColumns: t.project.kanbanColumns.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
      };
      const tForMap = {
        ...t,
        columnAssignment: t.columnAssignment
          ? {
              ...t.columnAssignment,
              column: {
                ...t.columnAssignment.column,
                createdAt: t.columnAssignment.column.createdAt.toISOString(),
              },
            }
          : null,
      };
      return this.mapToTaskDetails(tForMap, projectWithAllSkills);
    });
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
    const task = await this.findOne(id);
    this.terminalRegistry.assignTask(
      terminalId,
      (await this.toChatMessage(task)).task!,
    );
    return task;
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      columnId?: string | null;
      agentId?: string;
      model?: string;
    },
  ) {
    const { columnId, ...taskData } = data;
    await this.findOne(id);

    if (Object.keys(taskData).length > 0) {
      await this.prisma.task.update({ where: { id }, data: taskData });
    }

    if (columnId !== undefined) {
      await this.updateColumn(id, columnId);
    }

    this.logger.log(`Updated task ${id}`);
    return this.findOne(id);
  }
}
