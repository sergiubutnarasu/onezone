import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { UpdateAgentDto } from './agents.dto';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from '../auth/admin.guard';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.agentsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agentsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateAgentDto, @CurrentUser() user: AuthUser) {
    return this.agentsService.update(id, body, user.id);
  }

  @Patch(':id/global')
  @UseGuards(AdminGuard)
  updateGlobal(@Param('id') id: string, @Body() body: UpdateAgentDto, @CurrentUser() user: AuthUser) {
    return this.agentsService.updateGlobal(id, body, user.id);
  }
}
