import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterAgentInput {
  agentId: string;
  name: string;
  hostname: string;
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agent.findMany({
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async registerConnected(input: RegisterAgentInput) {
    const agent = await this.prisma.agent.upsert({
      where: { id: input.agentId },
      create: {
        id: input.agentId,
        name: input.name,
        hostname: input.hostname,
        isConnected: true,
        lastSeenAt: new Date(),
      },
      update: {
        name: input.name,
        hostname: input.hostname,
        isConnected: true,
        lastSeenAt: new Date(),
      },
    });
    this.logger.log(`Agent connected: ${agent.id} (${agent.name})`);
    return agent;
  }

  async markDisconnected(agentId: string) {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { isConnected: false, lastSeenAt: new Date() },
    });
    this.logger.log(`Agent disconnected: ${agent.id} (${agent.name})`);
    return agent;
  }
}
