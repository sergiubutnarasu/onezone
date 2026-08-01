import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const createMockPrisma = () =>
  ({
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  } as unknown as PrismaService);

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new NotificationsService(prisma);
  });

  describe('create', () => {
    it('creates a notification', async () => {
      const dto = { userId: 'user-1', message: 'Test notification', type: 'info' };
      prisma.notification.create.mockResolvedValue({ id: 'notif-1', ...dto });
      const result = await service.create(dto as any);
      expect(result).toEqual({ id: 'notif-1', ...dto });
      expect(prisma.notification.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('findAll', () => {
    it('returns paginated unread notifications', async () => {
      const notifications = [
        { id: 'n1', userId: 'user-1', readAt: null },
        { id: 'n2', userId: 'user-1', readAt: null },
      ];
      prisma.notification.findMany.mockResolvedValue(notifications);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.findAll('user-1', false, 1, 10);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(false);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          task: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
    });

    it('returns all notifications when includeRead is true', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('user-1', true, 1, 10);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('calculates hasMore correctly', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.findAll('user-1', false, 1, 2);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('markRead', () => {
    it('marks a single notification as read', async () => {
      prisma.notification.update.mockResolvedValue({ id: 'n1', readAt: new Date() });
      await service.markRead('n1', 'user-1');
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'user-1' },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      await service.markAllRead('user-1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('countUnread', () => {
    it('returns count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(5);
      const result = await service.countUnread('user-1');
      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
    });
  });
});
