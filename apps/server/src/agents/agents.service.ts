import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { STALE_THRESHOLD_MS } from '@onezone/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterAgentInput {
  name: string;
  hostname: string;
}

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // On server start, all previous socket connections are gone — mark everyone offline.
    void this.markAllAgentsDisconnected();
  }

  async markAllAgentsDisconnected() {
    const { count } = await this.prisma.agent.updateMany({
      where: { isConnected: true },
      data: { isConnected: false },
    });
    if (count > 0) {
      this.logger.log(`Marked ${count} agent(s) as disconnected on server start`);
    }
  }

  findAll() {
    return this.prisma.agent.findMany({
      orderBy: [{ isConnected: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Registers an agent by name. If an agent with the same name already exists
   * and is currently connected, throws a ConflictException. Otherwise returns
   * the existing agent record or creates a new one.
   */
  async registerByName(input: RegisterAgentInput) {
    const existing = await this.prisma.agent.findUnique({ where: { name: input.name } });

    if (existing?.isConnected) {
      throw new ConflictException(
        `Agent "${input.name}" is already connected. Stop the running agent before starting a new one.`,
      );
    }

    if (existing) {
      this.logger.log(`Agent re-registered: ${existing.id} (${existing.name})`);
      return existing;
    }

    const agent = await this.prisma.agent.create({
      data: {
        id: randomUUID(),
        name: input.name,
        hostname: input.hostname,
        isConnected: false,
      },
    });
    this.logger.log(`Agent created: ${agent.id} (${agent.name})`);
    return agent;
  }

  async updateHeartbeat(agentId: string) {
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { lastSeenAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async markStaleAgentsDisconnected() {
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    const { count } = await this.prisma.agent.updateMany({
      where: { isConnected: true, lastSeenAt: { lt: threshold } },
      data: { isConnected: false },
    });
    if (count > 0) {
      this.logger.warn(`Marked ${count} stale agent(s) as disconnected`);
    }
  }

  async markConnected(agentId: string) {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { isConnected: true, lastSeenAt: new Date() },
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
