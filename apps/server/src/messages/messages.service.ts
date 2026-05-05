import { Injectable, Logger } from "@nestjs/common";
import { MessageType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateMessageDto {
  roomId: string;
  taskId: string;
  role: string;
  terminalId?: string;
  terminalName?: string;
  messageType: MessageType;
  jobId?: string;
  command?: string;
  exitCode?: number;
  stream?: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  ts: number;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageDto) {
    this.logger.log(
      `Creating message for task ${dto.taskId} with role ${dto.role}`,
    );

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
      orderBy: { ts: "asc" },
    });
    // Convert BigInt ts to number for JSON serialization
    return messages.map((m) => ({ ...m, ts: Number(m.ts) }));
  }
}
