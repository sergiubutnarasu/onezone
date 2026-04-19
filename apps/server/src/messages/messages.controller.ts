import { Controller, Get, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller('tasks/:taskId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.messagesService.findByTask(taskId);
  }
}
