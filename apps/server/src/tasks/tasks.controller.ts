import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';

class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Patch(':taskId/status')
  updateStatus(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(taskId, body.status);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('taskId') taskId: string) {
    return this.tasksService.remove(taskId);
  }
}
