import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { TerminalsService } from './terminals.service';
import { TerminalRegistryService } from '../gateways/terminal-registry.service';
import { AssignTaskDto, RegisterTerminalDto } from './terminals.dto';

@Controller('terminals')
export class TerminalsController {
  constructor(
    private readonly terminalsService: TerminalsService,
    private readonly terminalRegistry: TerminalRegistryService,
  ) {}

  @Get()
  findAll() {
    return this.terminalsService.findAll();
  }

  @Post('register')
  register(@Body() dto: RegisterTerminalDto) {
    return this.terminalsService.registerByName({ name: dto.name, hostname: dto.hostname });
  }

  @Post(':terminalId/disconnect')
  disconnect(@Param('terminalId') terminalId: string) {
    return this.terminalsService.markDisconnected(terminalId);
  }

  @Post(':terminalId/assign-task')
  assignTask(@Param('terminalId') terminalId: string, @Body() dto: AssignTaskDto) {
    const sent = this.terminalRegistry.assignTask(terminalId, dto.taskId);
    if (!sent) {
      throw new NotFoundException(`Terminal ${terminalId} is not currently connected`);
    }
    return { terminalId, taskId: dto.taskId };
  }

  @Delete(':terminalId')
  async delete(@Param('terminalId') terminalId: string) {
    this.terminalRegistry.disconnectTerminal(terminalId);
    return this.terminalsService.delete(terminalId);
  }
}
