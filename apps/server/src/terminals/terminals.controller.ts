import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AgentTag, type ProjectBuilderCommandPayload } from '@onezone/shared';
import { AgentsService } from '../agents/agents.service';
import { ProjectsService } from '../projects/projects.service';
import { TerminalsService } from './terminals.service';
import { TerminalRegistryService } from '../gateways/terminal-registry.service';
import { TasksService } from '../tasks/tasks.service';
import { AssignTaskDto, RegisterTerminalDto, RunProjectBuilderDto } from './terminals.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('terminals')
export class TerminalsController {
  constructor(
    private readonly terminalsService: TerminalsService,
    private readonly terminalRegistry: TerminalRegistryService,
    private readonly tasksService: TasksService,
    private readonly agentsService: AgentsService,
    private readonly projectsService: ProjectsService,
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

  @Post(':terminalId/project-builder')
  async runProjectBuilder(
    @Param('terminalId') terminalId: string,
    @Body() dto: RunProjectBuilderDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.terminalsService.findOne(terminalId, user.id);
    if (!this.terminalRegistry.getSocketId(terminalId)) {
      throw new NotFoundException(`Terminal ${terminalId} is not currently connected`);
    }
    const agent = await this.agentsService.findOne(dto.agentId, user.id);
    if (!Object.values(AgentTag).includes(agent.tag as AgentTag)) {
      throw new NotFoundException(`Agent ${dto.agentId} has unsupported tag ${agent.tag}`);
    }
    const project = await this.projectsService.createPending({
      name: dto.name,
      description: dto.description,
      repository: dto.repository,
      defaultAgentId: dto.agentId,
      defaultModel: dto.model,
      userId: user.id,
    });
    const commandId = randomUUID();
    const payload: ProjectBuilderCommandPayload = {
      commandId,
      terminalId,
      projectId: project.id,
      projectName: dto.name,
      projectDescription: dto.description ?? null,
      repository: dto.repository ?? null,
      boardPrompt: dto.boardPrompt,
      agent: { id: agent.id, name: agent.name, tag: agent.tag as AgentTag },
      model: dto.model,
    };
    const sent = this.terminalRegistry.runProjectBuilderCommand(terminalId, payload);
    if (!sent) {
      await this.projectsService.updateStatus(project.id, "failed", user.id, {
        commandId,
        terminalId,
      });
      throw new NotFoundException(`Terminal ${terminalId} is not currently connected`);
    }
    return { terminalId, commandId, project };
  }

  @Delete(':terminalId')
  async delete(@Param('terminalId') terminalId: string, @CurrentUser() user: AuthUser) {
    this.terminalRegistry.disconnectTerminal(terminalId);
    return this.terminalsService.delete(terminalId, user.id);
  }
}
