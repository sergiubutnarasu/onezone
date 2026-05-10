import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { GlobalSkillsController } from './global-skills.controller';
import { ProjectsService } from './projects.service';
import { KanbanColumnsController } from './kanban-columns.controller';
import { KanbanColumnsService } from './kanban-columns.service';

@Module({
  controllers: [ProjectsController, GlobalSkillsController, KanbanColumnsController],
  providers: [ProjectsService, KanbanColumnsService],
  exports: [ProjectsService, KanbanColumnsService],
})
export class ProjectsModule {}
