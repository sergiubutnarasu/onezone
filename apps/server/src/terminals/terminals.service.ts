import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { STALE_THRESHOLD_MS } from '@onezone/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterTerminalInput {
  name: string;
  hostname: string;
  userId: string;
}

@Injectable()
export class TerminalsService implements OnModuleInit {
  private readonly logger = new Logger(TerminalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // On server start, all previous socket connections are gone — mark everyone offline.
    void this.markAllTerminalsDisconnected();
  }

  async markAllTerminalsDisconnected() {
    const { count } = await this.prisma.terminal.updateMany({
      where: { isConnected: true },
      data: { isConnected: false },
    });
    if (count > 0) {
      this.logger.log(`Marked ${count} terminal(s) as disconnected on server start`);
    }
  }

  findAll(userId: string) {
    return this.prisma.terminal.findMany({
      where: { userId },
      orderBy: [{ isConnected: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            taskAssignments: true,
          },
        },
      },
    }).then((terminals) =>
      terminals.map(({ _count, ...terminal }) => ({
        ...terminal,
        pendingTaskCount: _count.taskAssignments,
      }))
    );
  }

  async findOne(id: string, userId: string) {
    const terminal = await this.prisma.terminal.findUnique({ where: { id, userId } });
    if (!terminal) throw new NotFoundException(`Terminal ${id} not found`);
    return terminal;
  }

  /**
   * Registers a terminal by name. If a terminal with the same name already exists
   * and is currently connected with a recent heartbeat, throws a ConflictException.
   * Otherwise returns the existing terminal record or creates a new one.
   * Allows re-registration if the existing terminal is stale (no recent heartbeat).
   */
  async registerByName(input: RegisterTerminalInput) {
    const trimmedName = input.name.trim();
    const existing = await this.prisma.terminal.findUnique({ where: { name: trimmedName } });

    if (existing?.isConnected) {
      // Check if the existing connection is actually stale (no recent heartbeat)
      const isStale = existing.lastSeenAt &&
        new Date(existing.lastSeenAt).getTime() < Date.now() - STALE_THRESHOLD_MS;

      if (!isStale) {
        throw new ConflictException(
          `Terminal "${trimmedName}" is already connected. Stop the running terminal before starting a new one.`,
        );
      }

      // Stale terminal - allow re-registration. The new socket will call markConnected().
      this.logger.warn(`Terminal "${trimmedName}" was stale, allowing re-registration`);
    }

    if (existing) {
      this.logger.log(`Terminal re-registered: ${existing.id} (${existing.name})`);
      return existing;
    }

    const terminal = await this.prisma.terminal.create({
      data: {
        id: randomUUID(),
        name: trimmedName,
        hostname: input.hostname,
        isConnected: false,
        userId: input.userId,
      },
    });
    this.logger.log(`Terminal created: ${terminal.id} (${terminal.name})`);
    return terminal;
  }

  async updateHeartbeat(terminalId: string) {
    await this.prisma.terminal.update({
      where: { id: terminalId },
      data: { lastSeenAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async markStaleTerminalsDisconnected() {
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    const { count } = await this.prisma.terminal.updateMany({
      where: { isConnected: true, lastSeenAt: { lt: threshold } },
      data: { isConnected: false },
    });
    if (count > 0) {
      this.logger.warn(`Marked ${count} stale terminal(s) as disconnected`);
    }
  }

  async markConnected(terminalId: string) {
    const result = await this.prisma.terminal.updateMany({
      where: { id: terminalId },
      data: { isConnected: true, lastSeenAt: new Date() },
    });
    if (result.count > 0) {
      this.logger.log(`Terminal connected: ${terminalId}`);
    } else {
      this.logger.warn(`markConnected: terminal ${terminalId} not found in DB (needs re-registration)`);
    }
  }

  async markDisconnected(terminalId: string) {
    const result = await this.prisma.terminal.updateMany({
      where: { id: terminalId },
      data: { isConnected: false, lastSeenAt: new Date() },
    });
    if (result.count > 0) {
      this.logger.log(`Terminal disconnected: ${terminalId}`);
    }
  }

  async delete(terminalId: string, userId: string) {
    const terminal = await this.prisma.terminal.findUnique({ where: { id: terminalId, userId } });
    if (!terminal) throw new NotFoundException(`Terminal ${terminalId} not found`);

    await this.prisma.terminal.delete({ where: { id: terminalId } });
    this.logger.log(`Deleted terminal ${terminalId} (${terminal.name})`);
    return terminal;
  }
}
