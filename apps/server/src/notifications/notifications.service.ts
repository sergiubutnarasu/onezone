import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationDto {
  type: NotificationType;
  taskId: string;
  projectId: string;
  message: string;
  userId: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  async findAll(userId: string, includeRead: boolean, page: number, limit: number) {
    const where = includeRead ? { userId } : { userId, readAt: null };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          task: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total, page, limit, hasMore: skip + data.length < total };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }
}
