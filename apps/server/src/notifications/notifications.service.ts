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

  async findAll(includeRead: boolean) {
    return this.prisma.notification.findMany({
      where: includeRead ? undefined : { readAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        task: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
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
