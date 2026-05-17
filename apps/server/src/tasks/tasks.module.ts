import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { ProjectTasksController } from './project-tasks.controller';
import { TasksService } from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController, ProjectTasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
