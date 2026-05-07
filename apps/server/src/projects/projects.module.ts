import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { GlobalSkillsController } from './global-skills.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController, GlobalSkillsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
