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
import { TasksService } from './tasks.service';
import { AssignTerminalDto, UpdateTaskDto, UpdateTaskColumnDto } from './tasks.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Patch(':taskId/column')
  updateColumn(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskColumnDto,
  ) {
    return this.tasksService.updateColumn(taskId, body.columnId ?? null);
  }

  @Patch(':taskId/terminal')
  assignTerminal(
    @Param('taskId') taskId: string,
    @Body() body: AssignTerminalDto,
  ) {
    return this.tasksService.assignTerminal(taskId, body.terminalId);
  }

  @Patch(':taskId')
  update(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto,
  ) {
    return this.tasksService.update(taskId, body);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('taskId') taskId: string) {
    return this.tasksService.remove(taskId);
  }
}

