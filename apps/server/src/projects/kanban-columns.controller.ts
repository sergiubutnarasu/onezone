import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KanbanColumnsService } from './kanban-columns.service';
import { ProjectsService } from './projects.service';
import { CreateKanbanColumnDto, UpdateKanbanColumnDto, ReorderColumnsDto } from './kanban-columns.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('projects/:projectId/kanban-columns')
export class KanbanColumnsController {
  constructor(
    private readonly kanbanColumnsService: KanbanColumnsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  async findAll(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.projectsService.findOne(projectId, user.id);
    return this.kanbanColumnsService.findAllByProject(projectId, user.id);
  }

  @Get(':columnId')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('columnId') columnId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    return this.kanbanColumnsService.findOne(columnId, projectId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId') projectId: string,
    @Body() body: CreateKanbanColumnDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    return this.kanbanColumnsService.create(projectId, body, user.id);
  }

  @Patch(':columnId')
  async update(
    @Param('projectId') projectId: string,
    @Param('columnId') columnId: string,
    @Body() body: UpdateKanbanColumnDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    return this.kanbanColumnsService.update(columnId, body, projectId, user.id);
  }

  @Delete(':columnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('columnId') columnId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    return this.kanbanColumnsService.remove(columnId, projectId, user.id);
  }

  @Put('reorder')
  async reorder(
    @Param('projectId') projectId: string,
    @Body() body: ReorderColumnsDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    return this.kanbanColumnsService.reorder(projectId, body.columns);
  }
}
