// apps/server/src/auth/auth.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminEmail } from './admin-emails';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Device code flow ────────────────────────────────────────────────────────

  async createDeviceCode(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> {
    const deviceCode = randomBytes(32).toString('hex');
    const userCode = this.generateUserCode();
    const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN');
    const expiresIn = 600; // 10 minutes
    const interval = 5; // 5 seconds

    await this.prisma.deviceCode.create({
      data: {
        deviceCode,
        userCode,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        approved: false,
      },
    });

    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${webOrigin}/auth/activate`,
      expires_in: expiresIn,
      interval,
    };
  }

  async pollToken(deviceCode: string): Promise<{
    error?: string;
    access_token?: string;
    refresh_token?: string;
  }> {
    const record = await this.prisma.deviceCode.findUnique({
      where: { deviceCode },
    });

    if (!record) {
      return { error: 'invalid_grant' };
    }

    if (record.expiresAt < new Date()) {
      return { error: 'expired_token' };
    }

    if (
      record.lastPolledAt &&
      Date.now() - record.lastPolledAt.getTime() < 5000
    ) {
      return { error: 'slow_down' };
    }

    await this.prisma.deviceCode.update({
      where: { deviceCode },
      data: { lastPolledAt: new Date() },
    });

    if (!record.approved) {
      return { error: 'authorization_pending' };
    }

    if (!record.userId) {
      return { error: 'access_denied' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });

    if (!user) {
      return { error: 'access_denied' };
    }

    await this.prisma.deviceCode.delete({ where: { deviceCode } });

    return this.issueTokens(user.id, user.email);
  }

  async approveDeviceCode(userId: string, userCode: string): Promise<boolean> {
    const record = await this.prisma.deviceCode.findUnique({
      where: { userCode },
    });

    if (!record || record.approved || record.expiresAt < new Date()) {
      return false;
    }

    await this.prisma.deviceCode.update({
      where: { userCode },
      data: { approved: true, userId },
    });

    return true;
  }

  // ─── Standard auth ────────────────────────────────────────────────────────────

  async signup(
    email: string,
    password: string,
    name: string,
  ): Promise<{ access_token: string; refresh_token: string } | null> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return null;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name },
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return this.issueTokens(user.id, user.email);
  }

  async refreshToken(
    token: string,
  ): Promise<{ access_token: string; refresh_token: string } | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      return null;
    }

    // Extend grace period to handle concurrent requests
    await this.prisma.refreshToken.update({
      where: { token: tokenHash },
      data: { expiresAt: new Date(Date.now() + 60 * 1000) },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });

    if (!user) {
      return null;
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.refreshToken
      .delete({ where: { token: tokenHash } })
      .catch(() => {});
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) return null;
    return { ...user, isAdmin: isAdminEmail(this.config, user.email) };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────────

  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const accessToken = this.jwt.sign({ sub: userId, email });
    const refreshToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const refreshDaysStr = this.config.getOrThrow<string>('REFRESH_TOKEN_EXPIRES_IN');
    const refreshDays = parseInt(refreshDaysStr.replace('d', ''), 10);

    await this.prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private generateUserCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const pick = () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${pick()}-${pick()}`;
  }
}
