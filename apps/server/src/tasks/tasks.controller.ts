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
import { AssignTerminalDto, UpdateTaskStatusDto } from './tasks.dto';

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

  @Patch(':taskId/terminal')
  assignTerminal(
    @Param('taskId') taskId: string,
    @Body() body: AssignTerminalDto,
  ) {
    return this.tasksService.assignTerminal(taskId, body.terminalId);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('taskId') taskId: string) {
    return this.tasksService.remove(taskId);
  }
}
