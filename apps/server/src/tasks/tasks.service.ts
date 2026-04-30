import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { TaskStatus } from "@prisma/client";
import {
  AgentTag,
  TaskDetails,
  TaskStatus as SharedTaskStatus,
  ChatMessage,
  MessageRole,
} from "@onezone/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TaskOrderItemDto } from "./tasks.dto";
import { TerminalRegistryService } from "../gateways/terminal-registry.service";

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
      agent: { id: string; name: string; tag: string } | null;
    },
    status: SharedTaskStatus,
    project: {
      id: string;
      name: string;
      description?: string | null;
      defaultAgentId: string;
      defaultModel: string;
      defaultAgent: { id: string; name: string; tag: string; model: string; createdAt: Date };
    },
  ): TaskDetails {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status,
      agentId: task.agentId,
      agent: task.agent
        ? {
            id: task.agent.id,
            name: task.agent.name,
            tag: task.agent.tag as unknown as AgentTag,
          }
        : null,
      model: task.model,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        defaultAgentId: project.defaultAgentId,
        defaultModel: project.defaultModel,
        defaultAgent: {
          id: project.defaultAgent.id,
          name: project.defaultAgent.name,
          tag: project.defaultAgent.tag as unknown as AgentTag,
          model: project.defaultAgent.model,
          createdAt: project.defaultAgent.createdAt.toISOString(),
        },
      },
    };
  }

  private toChatMessage(
    task: Awaited<ReturnType<typeof this.findOne>>,
    statusOverride?: TaskStatus,
  ): ChatMessage {
    const status = (statusOverride ??
      task.status) as unknown as SharedTaskStatus;
    const project = task.project!;
    return {
      content: "",
      role: MessageRole.System,
      task: this.mapToTaskDetails(task, status, project),
    };
  }

  private flattenTask<
    T extends {
      terminalAssignment: { terminal: unknown; assignedAt: unknown } | null;
    },
  >(task: T) {
    const { terminalAssignment, ...rest } = task;
    return { ...rest, terminal: terminalAssignment?.terminal ?? null };
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
      where: { projectId, status: "BACKLOG" },
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
          agent: true,
        },
      });
    });
    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    const fullTask = await this.findOne(task.id);
    this.terminalRegistry.assignTask(data.terminalId, this.toChatMessage(fullTask).task!);
    return this.flattenTask(task);
  }

  async findAllByProject(projectId: string, status?: TaskStatus[]) {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        ...(status && status.length > 0 ? { status: { in: status } } : {}),
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        terminalAssignment: { include: { terminal: true } },
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
        project: { include: { defaultAgent: true } },
        agent: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.flattenTask(task);
  }

  async findOneDetails(id: string): Promise<TaskDetails> {
    const task = await this.findOne(id);
    return this.toChatMessage(task).task!;
  }

  async updateStatus(id: string, status: TaskStatus) {
    const existing = await this.findOne(id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { status },
    });
    this.logger.log(`Updated task ${id} status to ${status}`);
    this.terminalRegistry.notifyTaskStatusUpdated(
      id,
      this.toChatMessage(existing, status),
    );
    return task;
  }

  async reorder(projectId: string, items: TaskOrderItemDto[]) {
    const existing = await this.prisma.task.findMany({
      where: { id: { in: items.map((i) => i.id) }, projectId },
      select: { id: true, name: true, status: true },
    });
    const existingMap = new Map(existing.map((t) => [t.id, t]));
    const validItems = items.filter((i) => existingMap.has(i.id));

    await this.prisma.$transaction(
      validItems.map((item) =>
        this.prisma.task.update({
          where: { id: item.id },
          data: { status: item.status, order: item.order },
        }),
      ),
    );

    for (const item of validItems) {
      const prev = existingMap.get(item.id)!;
      if (prev.status !== item.status) {
        const updated = await this.findOne(item.id);
        this.terminalRegistry.notifyTaskStatusUpdated(
          item.id,
          this.toChatMessage(updated, item.status),
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
    const assignments = await this.prisma.taskTerminal.findMany({
      where: { terminalId },
      include: {
        task: {
          include: {
            project: { include: { defaultAgent: true } },
            agent: true,
          },
        },
      },
    });
    return assignments.map((a): TaskDetails => {
      const t = a.task;
      return this.mapToTaskDetails(
        t,
        t.status as unknown as SharedTaskStatus,
        t.project,
      );
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
    this.terminalRegistry.assignTask(terminalId, this.toChatMessage(task).task!);
    return task;
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: TaskStatus;
      agentId?: string;
      model?: string;
    },
  ) {
    await this.findOne(id);
    const task = await this.prisma.task.update({
      where: { id },
      data,
    });
    this.logger.log(`Updated task ${id}`);
    return task;
  }
}
