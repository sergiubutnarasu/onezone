import { Controller, Get, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('tasks/:taskId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.findByTask(taskId, user.id);
  }
}
