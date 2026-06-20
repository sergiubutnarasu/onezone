import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, ListTasksQueryDto, ReorderTasksDto } from './tasks.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('projects/:projectId/tasks')
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.create(projectId, { ...body, userId: user.id });
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: ListTasksQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.findAllByProject(projectId, user.id, query);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.findOne(taskId, user.id);
  }

  @Put('reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Body() body: ReorderTasksDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.reorder(projectId, body.tasks, user.id);
  }
}

