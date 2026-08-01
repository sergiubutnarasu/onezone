import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalsService } from './terminals.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';

const createMockPrisma = () =>
  ({
    terminal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaService);

describe('TerminalsService', () => {
  let service: TerminalsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new TerminalsService(prisma);
  });

  describe('markAllTerminalsDisconnected', () => {
    it('marks all connected terminals as disconnected', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 3 });
      await service.markAllTerminalsDisconnected();
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { isConnected: true },
        data: { isConnected: false },
      });
    });

    it('handles zero terminals to disconnect', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 0 });
      await service.markAllTerminalsDisconnected();
      expect(prisma.terminal.updateMany).toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('calls markAllTerminalsDisconnected on init', () => {
      const markAllSpy = vi.spyOn(service, 'markAllTerminalsDisconnected').mockResolvedValue(undefined);
      service.onModuleInit();
      expect(markAllSpy).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns terminals with pending task count', async () => {
      prisma.terminal.findMany.mockResolvedValue([
        { id: 't1', name: 'Terminal 1', isConnected: true, _count: { taskAssignments: 2 } },
        { id: 't2', name: 'Terminal 2', isConnected: false, _count: { taskAssignments: 0 } },
      ]);

      const result = await service.findAll('user-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('pendingTaskCount', 2);
      expect(result[1]).toHaveProperty('pendingTaskCount', 0);
    });
  });

  describe('findOne', () => {
    it('returns terminal when found', async () => {
      prisma.terminal.findUnique.mockResolvedValue({ id: 't1', name: 'Terminal 1' });
      const result = await service.findOne('t1', 'user-1');
      expect(result).toEqual({ id: 't1', name: 'Terminal 1' });
    });

    it('throws NotFoundException when terminal not found', async () => {
      prisma.terminal.findUnique.mockResolvedValue(null);
      await expect(service.findOne('t1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('registerByName', () => {
    it('creates new terminal when none exists', async () => {
      prisma.terminal.findFirst.mockResolvedValue(null);
      prisma.terminal.create.mockResolvedValue({ id: 'new-t1', name: 'My Terminal' });

      const result = await service.registerByName({
        name: 'My Terminal',
        hostname: 'host-1',
        userId: 'user-1',
      });

      expect(result).toEqual({ id: 'new-t1', name: 'My Terminal' });
      expect(prisma.terminal.create).toHaveBeenCalled();
    });

    it('returns existing terminal when found and not connected', async () => {
      prisma.terminal.findFirst.mockResolvedValue({
        id: 't1',
        name: 'My Terminal',
        isConnected: false,
      });

      const result = await service.registerByName({
        name: 'My Terminal',
        hostname: 'host-1',
        userId: 'user-1',
      });

      expect(result).toEqual({ id: 't1', name: 'My Terminal', isConnected: false });
      expect(prisma.terminal.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when terminal is connected and not stale', async () => {
      prisma.terminal.findFirst.mockResolvedValue({
        id: 't1',
        name: 'My Terminal',
        isConnected: true,
        lastSeenAt: new Date(),
      });

      await expect(
        service.registerByName({
          name: 'My Terminal',
          hostname: 'host-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows re-registration when terminal is stale', async () => {
      const staleDate = new Date(Date.now() - 30000); // 30 seconds ago
      prisma.terminal.findFirst.mockResolvedValue({
        id: 't1',
        name: 'My Terminal',
        isConnected: true,
        lastSeenAt: staleDate,
      });

      const result = await service.registerByName({
        name: 'My Terminal',
        hostname: 'host-1',
        userId: 'user-1',
      });

      expect(result).toEqual({ id: 't1', name: 'My Terminal', isConnected: true, lastSeenAt: staleDate });
    });
  });

  describe('updateHeartbeat', () => {
    it('updates heartbeat without userId', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 1 });
      await service.updateHeartbeat('t1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { lastSeenAt: expect.any(Date) },
      });
    });

    it('updates heartbeat with userId', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 1 });
      await service.updateHeartbeat('t1', 'user-1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'user-1' },
        data: { lastSeenAt: expect.any(Date) },
      });
    });
  });

  describe('markStaleTerminalsDisconnected', () => {
    it('marks stale terminals as disconnected', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 2 });
      await service.markStaleTerminalsDisconnected();
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: {
          isConnected: true,
          lastSeenAt: { lt: expect.any(Date) },
        },
        data: { isConnected: false },
      });
    });
  });

  describe('markConnected', () => {
    it('marks terminal as connected', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 1 });
      await service.markConnected('t1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { isConnected: true, lastSeenAt: expect.any(Date) },
      });
    });

    it('marks terminal as connected with userId', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 1 });
      await service.markConnected('t1', 'user-1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'user-1' },
        data: { isConnected: true, lastSeenAt: expect.any(Date) },
      });
    });

    it('warns when terminal not found', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 0 });
      await service.markConnected('t1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { isConnected: true, lastSeenAt: expect.any(Date) },
      });
    });
  });

  describe('markDisconnected', () => {
    it('marks terminal as disconnected', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 1 });
      await service.markDisconnected('t1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { isConnected: false, lastSeenAt: expect.any(Date) },
      });
    });

    it('marks terminal as disconnected with userId', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 1 });
      await service.markDisconnected('t1', 'user-1');
      expect(prisma.terminal.updateMany).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'user-1' },
        data: { isConnected: false, lastSeenAt: expect.any(Date) },
      });
    });

    it('does not log when count is 0', async () => {
      prisma.terminal.updateMany.mockResolvedValue({ count: 0 });
      await service.markDisconnected('t1');
      expect(prisma.terminal.updateMany).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes terminal when found', async () => {
      prisma.terminal.findUnique.mockResolvedValue({ id: 't1', name: 'Terminal 1' });
      prisma.terminal.delete.mockResolvedValue({ id: 't1' });
      const result = await service.delete('t1', 'user-1');
      expect(result).toEqual({ id: 't1', name: 'Terminal 1' });
      expect(prisma.terminal.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('throws NotFoundException when terminal not found', async () => {
      prisma.terminal.findUnique.mockResolvedValue(null);
      await expect(service.delete('t1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
