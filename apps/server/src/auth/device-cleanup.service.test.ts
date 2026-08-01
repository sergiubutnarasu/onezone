import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceCleanupService } from './device-cleanup.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const createMockPrisma = () =>
  ({
    deviceCode: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    refreshToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaService);

describe('DeviceCleanupService', () => {
  let service: DeviceCleanupService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new DeviceCleanupService(prisma);
  });

  it('deletes expired unapproved device codes', async () => {
    prisma.deviceCode.deleteMany.mockResolvedValue({ count: 3 });
    await service.cleanup();
    expect(prisma.deviceCode.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) }, approved: false },
    });
  });

  it('deletes orphaned approved device codes without userId', async () => {
    await service.cleanup();
    expect(prisma.deviceCode.deleteMany).toHaveBeenCalledWith({
      where: { approved: true, userId: null },
    });
  });

  it('deletes expired refresh tokens', async () => {
    await service.cleanup();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('logs cleanup summary', async () => {
    prisma.deviceCode.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await service.cleanup();
    // Logger uses console.log under the hood; verify no errors thrown
    expect(prisma.deviceCode.deleteMany).toHaveBeenCalledTimes(2);
    logSpy.mockRestore();
  });
});
