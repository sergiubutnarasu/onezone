// apps/server/src/auth/device-cleanup.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceCleanupService {
  private readonly logger = new Logger(DeviceCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *') // Daily at 3 AM
  async cleanup() {
    this.logger.log('Starting auth cleanup...');

    const expiredDevices = await this.prisma.deviceCode.deleteMany({
      where: { expiresAt: { lt: new Date() }, approved: false },
    });

    const orphanedDevices = await this.prisma.deviceCode.deleteMany({
      where: { approved: true, userId: null },
    });

    const expiredTokens = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    this.logger.log(
      `Cleaned up ${expiredDevices.count} expired and ${orphanedDevices.count} orphaned device codes, ` +
        `${expiredTokens.count} expired refresh tokens`,
    );
  }
}
