import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { TerminalsService } from './terminals.service';
import { TerminalRegistryService } from '../gateways/terminal-registry.service';
import { TasksService } from '../tasks/tasks.service';
import { AssignTaskDto, RegisterTerminalDto } from './terminals.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('terminals')
export class TerminalsController {
  constructor(
    private readonly terminalsService: TerminalsService,
    private readonly terminalRegistry: TerminalRegistryService,
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.terminalsService.findAll(user.id);
  }

  @Post('register')
  register(@Body() dto: RegisterTerminalDto, @CurrentUser() user: AuthUser) {
    return this.terminalsService.registerByName({ name: dto.name, hostname: dto.hostname, userId: user.id });
  }

  @Post(':terminalId/disconnect')
  async disconnect(@Param('terminalId') terminalId: string, @CurrentUser() user: AuthUser) {
    await this.terminalsService.findOne(terminalId, user.id);
    return this.terminalsService.markDisconnected(terminalId, user.id);
  }

  @Post(':terminalId/assign-task')
  async assignTask(
    @Param('terminalId') terminalId: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.terminalsService.findOne(terminalId, user.id);
    const task = await this.tasksService.findOneDetails(dto.taskId, user.id);
    const sent = this.terminalRegistry.assignTask(terminalId, task);
    if (!sent) {
      throw new NotFoundException(`Terminal ${terminalId} is not currently connected`);
    }
    return { terminalId, taskId: dto.taskId };
  }

  @Delete(':terminalId')
  async delete(@Param('terminalId') terminalId: string, @CurrentUser() user: AuthUser) {
    this.terminalRegistry.disconnectTerminal(terminalId);
    return this.terminalsService.delete(terminalId, user.id);
  }
}
