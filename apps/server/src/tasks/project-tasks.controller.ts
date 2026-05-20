import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, ReorderTasksDto } from './tasks.dto';

@Controller('projects/:projectId/tasks')
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateTaskDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.tasksService.create(projectId, { ...body, userId: req.user.id });
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.tasksService.findAllByProject(projectId);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Put('reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Body() body: ReorderTasksDto,
  ) {
    return this.tasksService.reorder(projectId, body.tasks);
  }
}

