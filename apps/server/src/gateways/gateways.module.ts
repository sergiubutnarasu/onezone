import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [MessagesModule, TasksModule],
  providers: [ChatGateway],
})
export class GatewaysModule {}
