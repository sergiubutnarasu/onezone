import { describe, it, expect, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('connects on module init', async () => {
    const service = new PrismaService();
    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue(undefined);
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
    connectSpy.mockRestore();
  });

  it('disconnects on module destroy', async () => {
    const service = new PrismaService();
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
    disconnectSpy.mockRestore();
  });

  it('pings the database', async () => {
    const service = new PrismaService();
    const querySpy = vi.spyOn(service, '$queryRaw').mockResolvedValue(undefined);
    await service.ping();
    expect(querySpy).toHaveBeenCalled();
    querySpy.mockRestore();
  });
});
