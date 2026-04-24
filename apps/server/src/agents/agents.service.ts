import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.agent.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async update(id: string, data: { model: string }) {
    await this.findOne(id);
    const agent = await this.prisma.agent.update({ where: { id }, data });
    this.logger.log(`Updated agent ${id} model to ${data.model}`);
    return agent;
  }
}
