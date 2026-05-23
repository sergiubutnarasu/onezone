import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { InstallSkillDto } from './projects.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('skills')
export class GlobalSkillsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.listGlobalSkills();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  install(@Body() body: InstallSkillDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.installGlobalSkill(body, user.id);
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('skillId') skillId: string) {
    return this.projectsService.removeGlobalSkill(skillId);
  }
}
