// apps/server/src/types/notification.ts

import type { NotificationType } from "@prisma/client";

export interface CreateNotificationDto {
  type: NotificationType;
  taskId: string;
  projectId: string;
  message: string;
  userId: string;
}
