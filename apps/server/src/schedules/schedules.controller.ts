import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';
import { SchedulesService } from './schedules.service';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('projects/:projectId/schedules')
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedulesService.findAllByProject(projectId, user.id);
  }

  @Post('projects/:projectId/schedules')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedulesService.create(projectId, body, user.id);
  }

  @Get('schedules/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.schedulesService.findOne(id, user.id);
  }

  @Patch('schedules/:id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedulesService.update(id, body, user.id);
  }

  @Delete('schedules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.schedulesService.remove(id, user.id);
  }

  @Post('schedules/:id/run')
  runNow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.schedulesService.runNow(id, user.id);
  }
}
