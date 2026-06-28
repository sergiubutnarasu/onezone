import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ChatMessage,
  KanbanColumn,
  MessageRole,
  TaskDetails,
} from "@onezone/shared";
import { MessageType, NotificationType } from "@prisma/client";
import { TerminalRegistryService } from "../gateways/terminal-registry.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { toAgentTag } from "../libs/agent-tag";
import { toISO, toISONow } from "../libs/date-mapper";
import { TaskOrderItemDto } from "./tasks.dto";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly terminalRegistry: TerminalRegistryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private mapToTaskDetails(
    task: {
      id: string;
      name: string;
      description?: string | null;
      agentId: string;
      model: string;
      useTaskAgentAndModel: boolean;
      completedAt?: Date | null;
      agent: { id: string; name: string; tag: string } | null;
      columnAssignment?: {
        column: {
          id: string;
          name: string;
          projectId?: string;
          instructions?: string;
          index?: number;
          agentId?: string | null;
          model?: string | null;
          createdAt?: string | Date;
          agent?: { id: string; name: string; tag: string } | null;
        };
      } | null;
    },
    project: {
      id: string;
      name: string;
      description?: string | null;
      repository?: string | null;
      defaultAgentId: string;
      defaultAgent?: { id: string; name: string; tag: string } | null;
      createdAt: string;
      defaultModel: string;
      skills?: { id: string; source: string; skillName: string }[];
      kanbanColumns?: KanbanColumn[];
    },
  ): TaskDetails {
    const raw = task.columnAssignment?.column ?? null;
    const rawColumnAgent = raw?.agent ?? null;
    const column: KanbanColumn | null = raw
      ? {
          id: raw.id,
          name: raw.name,
          projectId: raw.projectId ?? '',
          instructions: raw.instructions ?? '',
          index: raw.index ?? 0,
          agentId: raw.agentId ?? null,
          agent: rawColumnAgent
            ? {
                id: rawColumnAgent.id,
                name: rawColumnAgent.name,
                tag: toAgentTag(rawColumnAgent.tag),
              }
            : null,
          model: raw.model ?? null,
          createdAt: toISONow(raw.createdAt),
        }
      : null;
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      columnId: column?.id ?? null,
      column: column,
      completedAt: toISO(task.completedAt),
      agentId: task.agentId,
      agent: task.agent
        ? {
            id: task.agent.id,
            name: task.agent.name,
            tag: toAgentTag(task.agent.tag),
          }
        : null,
      model: task.model,
      useTaskAgentAndModel: task.useTaskAgentAndModel,
      projectId: project.id,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        repository: project.repository,
        defaultAgentId: project.defaultAgentId,
        defaultAgent: project.defaultAgent
          ? {
              id: project.defaultAgent.id,
              name: project.defaultAgent.name,
              tag: toAgentTag(project.defaultAgent.tag),
            }
          : null,
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
      where: { projectId: null, userId: task.userId },
    });
    const kanbanColumns = await this.prisma.kanbanColumn.findMany({
      where: { projectId: project.id },
      orderBy: { index: "asc" },
    });
    const projectWithAllSkills = {
      ...project,
      createdAt: toISO(project.createdAt),
      skills: [...(project.skills ?? []), ...globalSkills],
      kanbanColumns: kanbanColumns.map((c) => ({
        ...c,
        createdAt: toISO(c.createdAt),
      })),
    };
    const currentColumn =
      columnOverride !== undefined
        ? columnOverride
        : task.columnId
          ? (projectWithAllSkills.kanbanColumns.find((c) => c.id === task.columnId) ?? undefined)
          : undefined;

    // Resolve column agent for the current column when it has an agentId
    let resolvedColumnAgent: { id: string; name: string; tag: string } | null = null;
    if (currentColumn?.agentId) {
      resolvedColumnAgent = await this.prisma.agent.findUnique({
        where: { id: currentColumn.agentId },
        select: { id: true, name: true, tag: true },
      });
    }
    const taskWithColumnOverride =
      currentColumn !== undefined
        ? {
            ...task,
            columnAssignment: currentColumn
              ? { column: { ...currentColumn, agent: resolvedColumnAgent } }
              : null,
          }
        : task;
    return {
      content: "",
      role: MessageRole.System,
      task: this.mapToTaskDetails(taskWithColumnOverride, projectWithAllSkills),
    };
  }

  private async assignTaskToTerminalIfActive(
    task: Awaited<ReturnType<typeof this.findOne>>,
  ): Promise<void> {
    if (task.completedAt) return;
    const terminalId = (task.terminal as { id?: string } | null)?.id;
    if (!terminalId) return;
    this.terminalRegistry.assignTask(
      terminalId,
      (await this.toChatMessage(task)).task!,
    );
  }

  private async ensureProjectOwned(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  private async ensureTerminalOwned(terminalId: string, userId: string): Promise<void> {
    const terminal = await this.prisma.terminal.findUnique({ where: { id: terminalId, userId } });
    if (!terminal) throw new NotFoundException(`Terminal ${terminalId} not found`);
  }

  private async findColumnInProject(columnId: string, projectId: string, userId: string) {
    const column = await this.prisma.kanbanColumn.findUnique({
      where: { id: columnId },
      select: { id: true, name: true, index: true, projectId: true, userId: true, instructions: true, agentId: true, model: true, createdAt: true },
    });
    if (!column || column.projectId !== projectId || column.userId !== userId) {
      throw new BadRequestException('columnId does not belong to project');
    }
    return column;
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

  private async closeOpenCommandsForCompletedTask(
    taskId: string,
    userId: string,
  ): Promise<void> {
    const lifecycleMessages = await this.prisma.message.findMany({
      where: {
        taskId,
        userId,
        jobId: { not: null },
        OR: [
          { messageType: MessageType.COMMAND_START },
          { messageType: MessageType.COMMAND_EXIT },
          { exitCode: { not: null } },
        ],
      },
      orderBy: { ts: "asc" },
      select: {
        roomId: true,
        terminalId: true,
        terminalName: true,
        messageType: true,
        jobId: true,
        command: true,
        exitCode: true,
        agentId: true,
        model: true,
      },
    });

    const openStarts = new Map<
      string,
      (typeof lifecycleMessages)[number] & { jobId: string }
    >();

    for (const message of lifecycleMessages) {
      if (!message.jobId) continue;
      if (
        message.messageType === MessageType.COMMAND_EXIT ||
        message.exitCode !== null
      ) {
        openStarts.delete(message.jobId);
        continue;
      }
      if (message.messageType === MessageType.COMMAND_START) {
        openStarts.set(message.jobId, { ...message, jobId: message.jobId });
      }
    }

    let ts = Date.now();
    for (const start of openStarts.values()) {
      const exitTs = ts++;
      const terminalLabel = start.terminalName ?? start.terminalId ?? "terminal";
      const command = start.command ?? "";
      await this.prisma.message.create({
        data: {
          roomId: start.roomId,
          taskId,
          role: MessageRole.System,
          terminalId: start.terminalId,
          terminalName: start.terminalName,
          messageType: MessageType.COMMAND_EXIT,
          jobId: start.jobId,
          command,
          exitCode: 130,
          content: `[${terminalLabel}] cancelled because task was completed: ${command}`,
          agentId: start.agentId,
          model: start.model,
          userId,
          ts: BigInt(exitTs),
        },
      });
      this.terminalRegistry.notifyCommandExit(taskId, {
        roomId: start.roomId,
        terminalId: start.terminalId ?? "",
        jobId: start.jobId,
        command,
        exitCode: 130,
        ts: exitTs,
      });
    }

    if (openStarts.size > 0) {
      this.logger.log(
        `Closed ${openStarts.size} open command(s) for completed task ${taskId}`,
      );
    }
  }

  async create(
    projectId: string,
    data: {
      name: string;
      description?: string;
      terminalId: string;
      agentId?: string;
      model?: string;
      useTaskAgentAndModel?: boolean;
      userId: string;
      /**
       * Optional starting column. When provided, the task is created already
       * placed in this column inside the same transaction. This avoids the
       * race where a subsequent `updateColumn` call emits `TaskColumnUpdated`
       * before the terminal has joined the task room.
       */
      columnId?: string;
    },
  ) {
    const project = await this.ensureProjectOwned(projectId, data.userId);
    await this.ensureTerminalOwned(data.terminalId, data.userId);
    if (data.columnId) {
      await this.findColumnInProject(data.columnId, projectId, data.userId);
    }
    const agentId = data.agentId ?? project.defaultAgentId;
    const model = data.model ?? project.defaultModel;
    const count = await this.prisma.task.count({
      where: { projectId, userId: data.userId, columnAssignment: null },
    });
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          name: data.name,
          description: data.description,
          agentId,
          model,
          useTaskAgentAndModel: data.useTaskAgentAndModel ?? false,
          projectId,
          userId: data.userId,
          order: count,
        },
      });
      await tx.taskTerminal.create({
        data: { taskId: created.id, terminalId: data.terminalId },
      });
      if (data.columnId) {
        await tx.taskColumn.create({
          data: { taskId: created.id, columnId: data.columnId },
        });
      }
      return tx.task.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          terminalAssignment: { include: { terminal: true } },
          columnAssignment: { include: { column: { include: { agent: true } } } },
          agent: true,
        },
      });
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    const fullTask = await this.findOne(task.id, data.userId);
    const taskMessage = await this.toChatMessage(fullTask);
    this.terminalRegistry.assignTask(data.terminalId, taskMessage.task!);
    this.terminalRegistry.notifyTaskColumnUpdated(task.id, taskMessage);
    return this.flattenTask(task);
  }

  async findAllByProject(
    projectId: string,
    userId: string,
    query?: { orderBy?: string; order?: 'asc' | 'desc' },
  ) {
    const orderBy =
      query?.orderBy === 'createdAt'
        ? { createdAt: query.order ?? 'desc' }
        : { order: 'asc' as const };

    const tasks = await this.prisma.task.findMany({
      where: { projectId, userId },
      orderBy: [orderBy, { createdAt: 'desc' }],
      include: {
        terminalAssignment: { include: { terminal: true } },
        columnAssignment: { include: { column: { include: { agent: true } } } },
        agent: true,
      },
    });
    return tasks.map((t) => this.flattenTask(t));
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id, userId },
      include: {
        terminalAssignment: { include: { terminal: true } },
        columnAssignment: { include: { column: { include: { agent: true } } } },
        project: { include: { defaultAgent: true, skills: true } },
        agent: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.flattenTask(task);
  }

  async findOneDetails(id: string, userId: string): Promise<TaskDetails> {
    const task = await this.prisma.task.findUnique({
      where: { id, userId },
      include: {
        columnAssignment: { include: { column: { include: { agent: true } } } },
        project: {
          include: {
            defaultAgent: true,
            skills: true,
            kanbanColumns: { orderBy: { index: "asc" } },
          },
        },
        agent: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    const globalSkills = await this.prisma.projectSkill.findMany({
      where: { projectId: null, userId },
    });
    const project = task.project;
    const projectWithAllSkills = {
      ...project,
      createdAt: toISO(project.createdAt),
      skills: [...(project.skills ?? []), ...globalSkills],
      kanbanColumns: project.kanbanColumns.map((c) => ({
        ...c,
        createdAt: toISO(c.createdAt),
      })),
    };
    const taskForMap = {
      ...task,
      columnAssignment: task.columnAssignment
        ? {
            ...task.columnAssignment,
            column: {
              ...task.columnAssignment.column,
              createdAt: toISO(task.columnAssignment.column.createdAt),
            },
          }
        : null,
    };
    return this.mapToTaskDetails(taskForMap, projectWithAllSkills);
  }

  async updateColumn(id: string, columnId: string | null, userId: string) {
    const task = await this.findOne(id, userId);
    let column: KanbanColumn | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (columnId === null) {
        await tx.taskColumn.deleteMany({ where: { taskId: id } });
        await tx.task.update({ where: { id }, data: { completedAt: null } });
      } else {
        const col = await this.findColumnInProject(columnId, task.project!.id, userId);
        column = { ...col, createdAt: toISO(col.createdAt) };
        await tx.taskColumn.upsert({
          where: { taskId: id },
          create: { taskId: id, columnId },
          update: { columnId, assignedAt: new Date() },
        });
        await tx.task.update({ where: { id }, data: { completedAt: null } });
      }
    });

    this.logger.log(`Updated task ${id} column to ${columnId ?? "backlog"}`);
    const updated = await this.findOne(id, userId);
    this.terminalRegistry.notifyTaskColumnUpdated(
      id,
      await this.toChatMessage(updated, column),
    );
    await this.assignTaskToTerminalIfActive(updated);

    return updated;
  }

  async setCompleted(id: string, completed: boolean, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.task.update({
      where: { id },
      data: { completedAt: completed ? new Date() : null },
    });
    this.logger.log(`Set task ${id} completedAt to ${completed ? 'now' : 'null'}`);
    const updated = await this.findOne(id, userId);
    if (completed) {
      await this.closeOpenCommandsForCompletedTask(id, userId);
    }
    this.terminalRegistry.notifyTaskColumnUpdated(
      id,
      await this.toChatMessage(updated),
    );
    if (completed) {
      this.terminalRegistry.disconnectTaskTerminal(id);
      try {
        await this.notificationsService.create({
          type: NotificationType.TASK_COMPLETED,
          taskId: id,
          projectId: updated.project!.id,
          message: `Task "${updated.name}" was completed`,
          userId,
        });
      } catch (e) {
        this.logger.warn(`Failed to create task completed notification for task ${id}`, e);
      }
    } else {
      await this.assignTaskToTerminalIfActive(updated);
    }
    return updated;
  }

  async reorder(projectId: string, items: TaskOrderItemDto[], userId: string) {
    await this.ensureProjectOwned(projectId, userId);
    const existing = await this.prisma.task.findMany({
      where: { id: { in: items.map((i) => i.id) }, projectId, userId },
      include: { columnAssignment: true },
    });
    const existingMap = new Map(existing.map((t) => [t.id, t]));
    const validItems = items.filter((i) => existingMap.has(i.id));
    const columnIds = [...new Set(validItems.map((i) => i.columnId).filter((id): id is string => Boolean(id)))];
    if (columnIds.length > 0) {
      const columns = await this.prisma.kanbanColumn.findMany({
        where: { id: { in: columnIds }, projectId, userId },
        select: { id: true },
      });
      if (columns.length !== columnIds.length) {
        throw new BadRequestException('One or more columnId values do not belong to project');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        const prev = existingMap.get(item.id)!;
        const prevColumnId = prev.columnAssignment?.columnId ?? null;
        const columnChanged = item.columnId !== prevColumnId;

        const updateData: { order: number; completedAt?: Date | null } = {
          order: item.order,
        };
        if (columnChanged) {
          updateData.completedAt = null;
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
        const updated = await this.findOne(item.id, userId);
        let column: KanbanColumn | null = null;
        if (item.columnId) {
          const col = await this.prisma.kanbanColumn.findUnique({
            where: { id: item.columnId },
            select: { id: true, name: true, index: true, projectId: true, instructions: true, agentId: true, model: true, createdAt: true },
          });
          column = col ? { ...col, createdAt: toISO(col.createdAt) } : null;
        }
        this.terminalRegistry.notifyTaskColumnUpdated(
          item.id,
          await this.toChatMessage(updated, column),
        );
        await this.assignTaskToTerminalIfActive(updated);
      }
    }

    this.logger.log(
      `Reordered ${validItems.length} tasks for project ${projectId}`,
    );
    return this.findAllByProject(projectId, userId);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    this.terminalRegistry.cleanupTaskRoom(id);
    const task = await this.prisma.task.delete({ where: { id } });
    this.logger.log(`Deleted task ${id}`);
    return task;
  }

  async findByTerminal(terminalId: string): Promise<TaskDetails[]> {
    const assignments = await this.prisma.taskTerminal.findMany({
      where: { terminalId, task: { completedAt: null } },
      include: {
        task: {
          include: {
            columnAssignment: { include: { column: { include: { agent: true } } } },
            project: {
              include: {
                defaultAgent: true,
                skills: true,
                kanbanColumns: { orderBy: { index: "asc" } },
              },
            },
            agent: true,
          },
        },
      },
    });
    const userId = assignments[0]?.task.userId;
    const globalSkills = userId
      ? await this.prisma.projectSkill.findMany({ where: { projectId: null, userId } })
      : [];
    return assignments.map((a): TaskDetails => {
      const t = a.task;
      const projectWithAllSkills = {
        ...t.project,
        createdAt: toISO(t.project.createdAt),
        skills: [...(t.project.skills ?? []), ...globalSkills],
        kanbanColumns: t.project.kanbanColumns.map((c) => ({
          ...c,
          createdAt: toISO(c.createdAt),
        })),
      };
      const tForMap = {
        ...t,
        columnAssignment: t.columnAssignment
          ? {
              ...t.columnAssignment,
              column: {
                ...t.columnAssignment.column,
                createdAt: toISO(t.columnAssignment.column.createdAt),
              },
            }
          : null,
      };
      return this.mapToTaskDetails(tForMap, projectWithAllSkills);
    });
  }

  async assignTerminal(id: string, terminalId: string, userId: string) {
    await this.findOne(id, userId);
    await this.ensureTerminalOwned(terminalId, userId);
    await this.prisma.taskTerminal.upsert({
      where: { taskId: id },
      create: { taskId: id, terminalId },
      update: { terminalId, assignedAt: new Date() },
    });
    this.logger.log(`Assigned terminal ${terminalId} to task ${id}`);
    this.terminalRegistry.evictTaskTerminal(id);
    const task = await this.findOne(id, userId);
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
      useTaskAgentAndModel?: boolean;
    },
    userId: string,
  ) {
    const { columnId, ...taskData } = data;
    await this.findOne(id, userId);

    if (Object.keys(taskData).length > 0) {
      await this.prisma.task.update({ where: { id }, data: taskData });
    }

    if (columnId !== undefined) {
      await this.updateColumn(id, columnId, userId);
    }

    this.logger.log(`Updated task ${id}`);
    return this.findOne(id, userId);
  }
}
