// apps/server/src/gateways/gateways.module.ts

import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { TasksModule } from '../tasks/tasks.module';
import { TerminalsModule } from '../terminals/terminals.module';
import { ChatMessageHandler } from './message-handlers/chat-message.handler';
import { OutputLineHandler } from './message-handlers/output-line.handler';
import { CommandStartHandler } from './message-handlers/command-start.handler';
import { CommandExitHandler } from './message-handlers/command-exit.handler';
import { SocketAuthGuard } from './socket-auth.guard';

@Module({
  imports: [MessagesModule, TasksModule, TerminalsModule],
  providers: [
    ChatGateway,
    SocketAuthGuard,
    ChatMessageHandler,
    OutputLineHandler,
    CommandStartHandler,
    CommandExitHandler,
  ],
})
export class GatewaysModule {}
