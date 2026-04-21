import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { ProjectTasksController } from './project-tasks.controller';
import { TasksService } from './tasks.service';
import { AgentRegistryModule } from '../gateways/agent-registry.module';

@Module({
  imports: [AgentRegistryModule],
  controllers: [TasksController, ProjectTasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
