import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AgentRegistryModule } from './agent-registry.module';
import { MessagesModule } from '../messages/messages.module';
import { TasksModule } from '../tasks/tasks.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [MessagesModule, TasksModule, AgentsModule, AgentRegistryModule],
  providers: [ChatGateway],
})
export class GatewaysModule {}
