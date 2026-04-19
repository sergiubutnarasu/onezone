import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMessageDto {
  roomId: string;
  taskId: string;
  role: string;
  agentId?: string;
  agentName?: string;
  jobId?: string;
  command?: string;
  stream?: string;
  content: string;
  ts: number;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        ...dto,
        ts: BigInt(dto.ts),
      },
    });
  }

  async findByTask(taskId: string) {
    const messages = await this.prisma.message.findMany({
      where: { taskId },
      orderBy: { ts: 'asc' },
    });
    // Convert BigInt ts to number for JSON serialization
    return messages.map((m) => ({ ...m, ts: Number(m.ts) }));
  }
}
