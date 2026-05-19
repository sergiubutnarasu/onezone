import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationDto {
  type: NotificationType;
  taskId: string;
  projectId: string;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  async findAll(includeRead: boolean, page: number, limit: number) {
    const where = includeRead ? undefined : { readAt: null };
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

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead() {
    return this.prisma.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
  }

  async countUnread() {
    return this.prisma.notification.count({ where: { readAt: null } });
  }
}
