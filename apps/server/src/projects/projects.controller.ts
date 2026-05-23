import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, InstallSkillDto, UpdateProjectDto } from './projects.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.create({ ...body, userId: user.id });
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.projectsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.update(id, body, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.remove(id, user.id);
  }

  @Get(':id/skills')
  listSkills(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.listSkills(id, user.id);
  }

  @Get(':id/cost-stats')
  getCostStats(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.getCostStats(id, user.id);
  }

  @Post(':id/skills')
  @HttpCode(HttpStatus.CREATED)
  installSkill(@Param('id') id: string, @Body() body: InstallSkillDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.installSkill(id, body, user.id);
  }

  @Delete(':id/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSkill(@Param('id') id: string, @Param('skillId') skillId: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.removeSkill(id, skillId, user.id);
  }
}
