import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { STALE_THRESHOLD_MS } from '@onezone/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterTerminalInput {
  name: string;
  hostname: string;
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

  findAll() {
    return this.prisma.terminal.findMany({
      orderBy: [{ isConnected: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            tasks: { where: { status: { not: 'DONE' } } },
          },
        },
      },
    }).then((terminals) =>
      terminals.map(({ _count, ...terminal }) => ({
        ...terminal,
        pendingTaskCount: _count.tasks,
      }))
    );
  }

  /**
   * Registers a terminal by name. If a terminal with the same name already exists
   * and is currently connected, throws a ConflictException. Otherwise returns
   * the existing terminal record or creates a new one.
   */
  async registerByName(input: RegisterTerminalInput) {
    const existing = await this.prisma.terminal.findUnique({ where: { name: input.name } });

    if (existing?.isConnected) {
      throw new ConflictException(
        `Terminal "${input.name}" is already connected. Stop the running terminal before starting a new one.`,
      );
    }

    if (existing) {
      this.logger.log(`Terminal re-registered: ${existing.id} (${existing.name})`);
      return existing;
    }

    const terminal = await this.prisma.terminal.create({
      data: {
        id: randomUUID(),
        name: input.name,
        hostname: input.hostname,
        isConnected: false,
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
    const terminal = await this.prisma.terminal.update({
      where: { id: terminalId },
      data: { isConnected: true, lastSeenAt: new Date() },
    });
    this.logger.log(`Terminal connected: ${terminal.id} (${terminal.name})`);
    return terminal;
  }

  async markDisconnected(terminalId: string) {
    const terminal = await this.prisma.terminal.update({
      where: { id: terminalId },
      data: { isConnected: false, lastSeenAt: new Date() },
    });
    this.logger.log(`Terminal disconnected: ${terminal.id} (${terminal.name})`);
    return terminal;
  }

  async delete(terminalId: string) {
    const terminal = await this.prisma.terminal.findUnique({ where: { id: terminalId } });
    if (!terminal) throw new NotFoundException(`Terminal ${terminalId} not found`);

    const taskCount = await this.prisma.task.count({ where: { terminalId } });
    if (taskCount > 0) {
      throw new ConflictException(
        `Terminal "${terminal.name}" has ${taskCount} task(s) assigned. Reassign or delete them first.`,
      );
    }

    await this.prisma.terminal.delete({ where: { id: terminalId } });
    this.logger.log(`Deleted terminal ${terminalId} (${terminal.name})`);
    return terminal;
  }
}
