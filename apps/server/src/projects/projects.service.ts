import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TerminalRegistryService } from '../gateways/terminal-registry.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly terminalRegistry: TerminalRegistryService,
  ) {}

  async create(data: { name: string; description?: string; repository?: string; defaultAgentId: string; defaultModel: string }) {
    const project = await this.prisma.project.create({ data });
    this.logger.log(`Created project ${project.id}`);
    return project;
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { defaultAgent: true, skills: true },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id }, include: { defaultAgent: true, skills: true } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: string, data: { name?: string; description?: string; repository?: string; defaultAgentId?: string; defaultModel?: string }) {
    await this.findOne(id);
    const project = await this.prisma.project.update({ where: { id }, data });
    this.logger.log(`Updated project ${id}`);
    return project;
  }

  async remove(id: string) {
    await this.findOne(id);

    const tasks = await this.prisma.task.findMany({
      where: { projectId: id },
      select: { id: true },
    });

    for (const task of tasks) {
      this.terminalRegistry.cleanupTaskRoom(task.id);
    }

    const project = await this.prisma.project.delete({ where: { id } });
    this.logger.log(`Deleted project ${id} and cleaned up ${tasks.length} task room(s)`);
    return project;
  }

  async listSkills(projectId: string) {
    await this.findOne(projectId);
    return this.prisma.projectSkill.findMany({
      where: { projectId },
      orderBy: { installedAt: 'asc' },
    });
  }

  async installSkill(projectId: string, data: { source: string; skillName: string }) {
    await this.findOne(projectId);

    const existing = await this.prisma.projectSkill.findUnique({
      where: { projectId_skillName: { projectId, skillName: data.skillName } },
    });
    if (existing) {
      throw new ConflictException(`Skill "${data.skillName}" is already installed on this project`);
    }

    const skill = await this.prisma.projectSkill.create({
      data: { projectId, source: data.source, skillName: data.skillName },
    });

    this.logger.log(`Saved skill "${data.skillName}" on project ${projectId}`);
    return skill;
  }

  async removeSkill(projectId: string, skillId: string) {
    const skill = await this.prisma.projectSkill.findUnique({ where: { id: skillId } });
    if (!skill || skill.projectId !== projectId) {
      throw new NotFoundException(`Skill ${skillId} not found on project ${projectId}`);
    }

    await this.prisma.projectSkill.delete({ where: { id: skillId } });
    this.logger.log(`Removed skill "${skill.skillName}" from project ${projectId}`);
  }
}

