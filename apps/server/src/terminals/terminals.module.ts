import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';

@Module({
  imports: [PrismaModule, AgentsModule, ProjectsModule, TasksModule],
  controllers: [TerminalsController],
  providers: [TerminalsService],
  exports: [TerminalsService],
})
export class TerminalsModule {}
