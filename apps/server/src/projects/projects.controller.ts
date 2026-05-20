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
  Request,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, InstallSkillDto, UpdateProjectDto } from './projects.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateProjectDto, @Request() req: { user: { id: string } }) {
    return this.projectsService.create({ ...body, userId: req.user.id });
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return this.projectsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Get(':id/skills')
  listSkills(@Param('id') id: string) {
    return this.projectsService.listSkills(id);
  }

  @Get(':id/cost-stats')
  getCostStats(@Param('id') id: string) {
    return this.projectsService.getCostStats(id);
  }

  @Post(':id/skills')
  @HttpCode(HttpStatus.CREATED)
  installSkill(@Param('id') id: string, @Body() body: InstallSkillDto, @Request() req: { user: { id: string } }) {
    return this.projectsService.installSkill(id, body, req.user.id);
  }

  @Delete(':id/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSkill(@Param('id') id: string, @Param('skillId') skillId: string) {
    return this.projectsService.removeSkill(id, skillId);
  }
}
