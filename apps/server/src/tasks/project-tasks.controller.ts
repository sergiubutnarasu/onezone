import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';

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
}
