import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { S3Service } from '../s3/s3.service';
import { ProjectsService } from '../projects/projects.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { WriteMemoryDto } from './memory.dto';

// Agents read/write many memory files in quick bursts (INDEX.md + every
// relevant wiki article at session start, several rewrites at session end).
// The global default (10 req/60s) is tuned for auth endpoints and throttles
// these legitimate bursts; use a much higher, still-bounded limit here.
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('projects/:projectId/memory')
export class MemoryController {
  constructor(
    private readonly s3: S3Service,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Query('prefix') prefix?: string,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    const keys = await this.s3.list(projectId, prefix);
    return { keys };
  }

  @Get(':key(*)')
  async read(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    const content = await this.s3.read(projectId, key);
    if (content === null) {
      return { content: null };
    }
    return { content };
  }

  @Post(':key(*)')
  @HttpCode(HttpStatus.OK)
  async write(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('key') key: string,
    @Body() body: WriteMemoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    await this.s3.write(projectId, key, body.content);
    return { ok: true };
  }

  @Delete(':key(*)')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.findOne(projectId, user.id);
    await this.s3.delete(projectId, key);
  }
}
