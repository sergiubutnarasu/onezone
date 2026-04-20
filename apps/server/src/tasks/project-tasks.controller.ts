import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ReorderTasksDto } from './tasks.dto';

@Controller('projects/:projectId/tasks')
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; description?: string },
  ) {
    return this.tasksService.create(projectId, body);
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
