import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { InstallSkillDto } from './projects.dto';

@Controller('skills')
export class GlobalSkillsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.listGlobalSkills();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  install(@Body() body: InstallSkillDto) {
    return this.projectsService.installGlobalSkill(body);
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('skillId') skillId: string) {
    return this.projectsService.removeGlobalSkill(skillId);
  }
}
