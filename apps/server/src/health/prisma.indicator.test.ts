import { describe, it, expect, vi } from 'vitest';
import { PrismaHealthIndicator } from './prisma.indicator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthCheckError } from '@nestjs/terminus';

const createMockPrisma = (pingResult: Promise<void> | 'throw' = Promise.resolve()) =>
  ({
    ping: vi.fn().mockImplementation(() =>
      pingResult === 'throw' ? Promise.reject(new Error('DB down')) : pingResult,
    ),
  } as unknown as PrismaService);

describe('PrismaHealthIndicator', () => {
  it('returns healthy when ping succeeds', async () => {
    const prisma = createMockPrisma();
    const indicator = new PrismaHealthIndicator(prisma);
    const result = await indicator.pingCheck('prisma');
    expect(result).toEqual({ prisma: { status: 'up' } });
  });

  it('throws HealthCheckError when ping fails', async () => {
    const prisma = createMockPrisma('throw');
    const indicator = new PrismaHealthIndicator(prisma);
    await expect(indicator.pingCheck('prisma')).rejects.toThrow(HealthCheckError);
  });
});
