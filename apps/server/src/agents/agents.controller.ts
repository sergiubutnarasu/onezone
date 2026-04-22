import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentRegistryService } from '../gateways/agent-registry.service';
import { AssignTaskDto, RegisterAgentDto } from './agents.dto';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  @Get()
  findAll() {
    return this.agentsService.findAll();
  }

  @Post('register')
  register(@Body() dto: RegisterAgentDto) {
    return this.agentsService.registerByName({ name: dto.name, hostname: dto.hostname });
  }

  @Post(':agentId/disconnect')
  disconnect(@Param('agentId') agentId: string) {
    return this.agentsService.markDisconnected(agentId);
  }

  @Post(':agentId/assign-task')
  assignTask(@Param('agentId') agentId: string, @Body() dto: AssignTaskDto) {
    const sent = this.agentRegistry.assignTask(agentId, dto.taskId);
    if (!sent) {
      throw new NotFoundException(`Agent ${agentId} is not currently connected`);
    }
    return { agentId, taskId: dto.taskId };
  }

  @Delete(':agentId')
  async delete(@Param('agentId') agentId: string) {
    this.agentRegistry.disconnectAgent(agentId);
    return this.agentsService.delete(agentId);
  }
}
