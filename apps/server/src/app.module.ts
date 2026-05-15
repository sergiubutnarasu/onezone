import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { MessagesModule } from './messages/messages.module';
import { GatewaysModule } from './gateways/gateways.module';
import { TerminalsModule } from './terminals/terminals.module';
import { AgentsModule } from './agents/agents.module';
import { TerminalRegistryModule } from './gateways/terminal-registry.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TerminalRegistryModule,
    ProjectsModule,
    TasksModule,
    MessagesModule,
    TerminalsModule,
    AgentsModule,
    GatewaysModule,
  ],
})
export class AppModule {}
