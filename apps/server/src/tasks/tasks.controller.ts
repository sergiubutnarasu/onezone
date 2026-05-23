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
import { AssignTerminalDto, UpdateTaskDto, UpdateTaskColumnDto, ToggleCompletedDto } from './tasks.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.findOne(taskId, user.id);
  }

  @Patch(':taskId/column')
  updateColumn(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskColumnDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.updateColumn(taskId, body.columnId ?? null, user.id);
  }

  @Patch(':taskId/complete')
  setCompleted(
    @Param('taskId') taskId: string,
    @Body() body: ToggleCompletedDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.setCompleted(taskId, body.completed, user.id);
  }

  @Patch(':taskId/terminal')
  assignTerminal(
    @Param('taskId') taskId: string,
    @Body() body: AssignTerminalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.assignTerminal(taskId, body.terminalId, user.id);
  }

  @Patch(':taskId')
  update(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.update(taskId, body, user.id);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.remove(taskId, user.id);
  }
}

