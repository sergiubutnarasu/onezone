import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
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
