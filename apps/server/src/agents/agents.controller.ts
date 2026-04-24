import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { UpdateAgentDto } from './agents.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateAgentDto) {
    return this.agentsService.update(id, body);
  }
}
