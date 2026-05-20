import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, Request } from '@nestjs/common';
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
  install(@Body() body: InstallSkillDto, @Request() req: { user: { id: string } }) {
    return this.projectsService.installGlobalSkill(body, req.user.id);
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('skillId') skillId: string) {
    return this.projectsService.removeGlobalSkill(skillId);
  }
}
