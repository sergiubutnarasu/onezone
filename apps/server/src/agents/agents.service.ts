import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const agents = await this.prisma.agent.findMany({
      orderBy: { name: 'asc' },
      include: { userSettings: { where: { userId }, take: 1 } },
    });
    return agents.map(({ userSettings, ...agent }) => ({
      ...agent,
      defaultModel: agent.model,
      userModel: userSettings[0]?.model ?? null,
      model: userSettings[0]?.model ?? agent.model,
    }));
  }

  async findOne(id: string, userId?: string) {
    if (!userId) {
      const agent = await this.prisma.agent.findUnique({ where: { id } });
      if (!agent) throw new NotFoundException(`Agent ${id} not found`);
      return agent;
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: { userSettings: { where: { userId }, take: 1 } },
    });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    const { userSettings, ...baseAgent } = agent;
    return {
      ...baseAgent,
      defaultModel: baseAgent.model,
      userModel: userSettings[0]?.model ?? null,
      model: userSettings[0]?.model ?? baseAgent.model,
    };
  }

  async update(id: string, data: { model: string }, userId: string) {
    await this.findOne(id);
    await this.prisma.userAgentSetting.upsert({
      where: { userId_agentId: { userId, agentId: id } },
      create: { userId, agentId: id, model: data.model },
      update: { model: data.model },
    });
    this.logger.log(`Updated user ${userId} agent ${id} model to ${data.model}`);
    return this.findOne(id, userId);
  }

  async updateGlobal(id: string, data: { model: string }, userId: string) {
    await this.findOne(id);
    await this.prisma.agent.update({ where: { id }, data: { model: data.model } });
    this.logger.log(`Updated global agent ${id} model to ${data.model}`);
    return this.findOne(id, userId);
  }
}
