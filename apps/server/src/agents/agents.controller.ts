import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AgentsService } from './agents.service';

class RegisterAgentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  hostname!: string;
}

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll() {
    return this.agentsService.findAll();
  }

  @Post('register')
  register(@Body() dto: RegisterAgentDto) {
    return this.agentsService.registerByName({ name: dto.name, hostname: dto.hostname });
  }
}
