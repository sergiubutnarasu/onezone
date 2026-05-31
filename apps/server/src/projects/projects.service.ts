import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ProjectStatistics, ProjectStatisticsRow } from "@onezone/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TerminalRegistryService } from "../gateways/terminal-registry.service";
import { KanbanColumnsService } from "./kanban-columns.service";

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly terminalRegistry: TerminalRegistryService,
    private readonly kanbanColumnsService: KanbanColumnsService,
  ) {}

  async create(data: {
    name: string;
    description?: string;
    repository?: string;
    defaultAgentId: string;
    defaultModel: string;
    userId: string;
  }) {
    const project = await this.prisma.project.create({ data });
    await this.kanbanColumnsService.createDefaults(project.id, data.userId);
    this.logger.log(
      `Created project ${project.id} with default kanban columns`,
    );
    return project;
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { skills: true },
    });
  }

  async getStatistics(userId: string): Promise<ProjectStatistics> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        tasks: { select: { id: true, completedAt: true } },
      },
    });

    const rows = new Map<string, ProjectStatisticsRow>();
    for (const project of projects) {
      rows.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        tasksDone: project.tasks.filter((task) => task.completedAt !== null).length,
        totalTasks: project.tasks.length,
        jobsSucceeded: 0,
        jobsFailed: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      });
    }

    const commandExits = await this.prisma.message.findMany({
      where: {
        userId,
        messageType: "COMMAND_EXIT",
      },
      select: {
        exitCode: true,
        inputTokens: true,
        outputTokens: true,
        totalCostUsd: true,
        task: { select: { projectId: true } },
      },
    });

    for (const message of commandExits) {
      const row = rows.get(message.task.projectId);
      if (!row || message.exitCode === null) continue;

      if (message.exitCode === 0) {
        row.jobsSucceeded += 1;
      } else {
        row.jobsFailed += 1;
      }
      row.inputTokens += message.inputTokens ?? 0;
      row.outputTokens += message.outputTokens ?? 0;
      row.costUsd += message.totalCostUsd ?? 0;
    }

    const projectsWithStats = Array.from(rows.values());
    const totals = projectsWithStats.reduce(
      (acc, row) => ({
        tasksDone: acc.tasksDone + row.tasksDone,
        totalTasks: acc.totalTasks + row.totalTasks,
        jobsSucceeded: acc.jobsSucceeded + row.jobsSucceeded,
        jobsFailed: acc.jobsFailed + row.jobsFailed,
        inputTokens: acc.inputTokens + row.inputTokens,
        outputTokens: acc.outputTokens + row.outputTokens,
        costUsd: acc.costUsd + row.costUsd,
      }),
      {
        tasksDone: 0,
        totalTasks: 0,
        jobsSucceeded: 0,
        jobsFailed: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      },
    );

    return { totals, projects: projectsWithStats };
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id, userId },
      include: { skills: true },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      repository?: string;
      defaultAgentId?: string;
      defaultModel?: string;
    },
    userId: string,
  ) {
    await this.findOne(id, userId);
    const project = await this.prisma.project.update({ where: { id }, data });
    this.logger.log(`Updated project ${id}`);
    return project;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId: id },
      select: { id: true },
    });

    for (const task of tasks) {
      this.terminalRegistry.cleanupTaskRoom(task.id);
    }

    const project = await this.prisma.project.delete({ where: { id } });
    this.logger.log(
      `Deleted project ${id} and cleaned up ${tasks.length} task room(s)`,
    );
    return project;
  }

  async listSkills(projectId: string, userId: string) {
    await this.findOne(projectId, userId);
    return this.prisma.projectSkill.findMany({
      where: { projectId },
      orderBy: { installedAt: "asc" },
    });
  }

  async installSkill(
    projectId: string,
    data: { source: string; skillName: string },
    userId: string,
  ) {
    await this.findOne(projectId, userId);

    const existing = await this.prisma.projectSkill.findUnique({
      where: { projectId_skillName: { projectId, skillName: data.skillName } },
    });
    if (existing) {
      throw new ConflictException(
        `Skill "${data.skillName}" is already installed on this project`,
      );
    }

    const skill = await this.prisma.projectSkill.create({
      data: { projectId, source: data.source, skillName: data.skillName, userId },
    });

    this.logger.log(`Saved skill "${data.skillName}" on project ${projectId}`);
    return skill;
  }

  async removeSkill(projectId: string, skillId: string, userId: string) {
    await this.findOne(projectId, userId);
    const skill = await this.prisma.projectSkill.findUnique({
      where: { id: skillId },
    });
    if (!skill || skill.projectId !== projectId) {
      throw new NotFoundException(
        `Skill ${skillId} not found on project ${projectId}`,
      );
    }

    await this.prisma.projectSkill.delete({ where: { id: skillId } });
    this.logger.log(
      `Removed skill "${skill.skillName}" from project ${projectId}`,
    );
  }

  async listGlobalSkills() {
    return this.prisma.projectSkill.findMany({
      where: { projectId: null },
      orderBy: { installedAt: "asc" },
    });
  }

  async installGlobalSkill(data: { source: string; skillName: string }, userId: string) {
    const existing = await this.prisma.projectSkill.findFirst({
      where: { projectId: null, skillName: data.skillName },
    });
    if (existing) {
      throw new ConflictException(
        `Global skill "${data.skillName}" is already installed`,
      );
    }

    const skill = await this.prisma.projectSkill.create({
      data: { source: data.source, skillName: data.skillName, userId },
    });

    this.logger.log(`Saved global skill "${data.skillName}"`);
    return skill;
  }

  async removeGlobalSkill(skillId: string) {
    const skill = await this.prisma.projectSkill.findUnique({
      where: { id: skillId },
    });
    if (!skill || skill.projectId !== null) {
      throw new NotFoundException(`Global skill ${skillId} not found`);
    }

    await this.prisma.projectSkill.delete({ where: { id: skillId } });
    this.logger.log(`Removed global skill "${skill.skillName}"`);
  }

  async exportConfig(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: {
        defaultAgent: true,
        kanbanColumns: { orderBy: { index: 'asc' }, include: { agent: true } },
        skills: { orderBy: { installedAt: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return {
      version: '1',
      name: project.name,
      description: project.description ?? null,
      repository: project.repository ?? null,
      defaultAgent: project.defaultAgent.name,
      defaultModel: project.defaultModel,
      columns: project.kanbanColumns.map((col) => ({
        name: col.name,
        instructions: col.instructions,
        agent: col.agent?.name ?? null,
        model: col.model ?? null,
      })),
      skills: project.skills.map((s) => ({
        source: s.source,
        skillName: s.skillName,
      })),
    };
  }

  async importConfig(
    data: {
      version: string;
      name: string;
      description?: string | null;
      repository?: string | null;
      defaultAgent: string;
      defaultModel: string;
      columns: { name: string; instructions?: string; agent?: string | null; model?: string | null }[];
      skills?: { source: string; skillName: string }[];
    },
    userId: string,
  ) {
    const defaultAgent = await this.prisma.agent.findFirst({ where: { name: data.defaultAgent } });
    if (!defaultAgent) throw new NotFoundException(`Agent "${data.defaultAgent}" not found`);

    const allAgentNames = [...new Set(data.columns.map((c) => c.agent).filter(Boolean) as string[])];
    const agentMap = new Map<string, string>();
    agentMap.set(defaultAgent.name, defaultAgent.id);

    for (const agentName of allAgentNames) {
      if (!agentMap.has(agentName)) {
        const agent = await this.prisma.agent.findFirst({ where: { name: agentName } });
        if (agent) agentMap.set(agentName, agent.id);
      }
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          repository: data.repository ?? null,
          defaultAgentId: defaultAgent.id,
          defaultModel: data.defaultModel,
          userId,
        },
      });

      if (data.columns.length > 0) {
        await tx.kanbanColumn.createMany({
          data: data.columns.map((col, index) => ({
            projectId: created.id,
            name: col.name,
            instructions: col.instructions ?? '',
            index,
            agentId: col.agent ? (agentMap.get(col.agent) ?? null) : null,
            model: col.model ?? null,
            userId,
          })),
        });
      } else {
        await this.kanbanColumnsService.createDefaults(created.id, userId, tx);
      }

      if (data.skills && data.skills.length > 0) {
        const uniqueSkills = Array.from(
          new Map(data.skills.map((s) => [s.skillName, s])).values(),
        );
        await tx.projectSkill.createMany({
          data: uniqueSkills.map((s) => ({
            projectId: created.id,
            source: s.source,
            skillName: s.skillName,
            userId,
          })),
        });
      }

      return created;
    });

    this.logger.log(`Imported project config as project ${project.id}`);
    return project;
  }

  async getCostStats(projectId: string, userId: string): Promise<{
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }> {
    await this.findOne(projectId, userId);
    const result = await this.prisma.message.aggregate({
      where: {
        task: { projectId },
        messageType: 'COMMAND_EXIT',
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalCostUsd: true,
      },
    });
    return {
      inputTokens: result._sum.inputTokens ?? 0,
      outputTokens: result._sum.outputTokens ?? 0,
      costUsd: result._sum.totalCostUsd ?? 0,
    };
  }
}
