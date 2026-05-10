import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KanbanColumnsService } from './kanban-columns.service';
import { CreateKanbanColumnDto, UpdateKanbanColumnDto, ReorderColumnsDto } from './kanban-columns.dto';

@Controller('projects/:projectId/kanban-columns')
export class KanbanColumnsController {
  constructor(private readonly kanbanColumnsService: KanbanColumnsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.kanbanColumnsService.findAllByProject(projectId);
  }

  @Get(':columnId')
  findOne(@Param('columnId') columnId: string) {
    return this.kanbanColumnsService.findOne(columnId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateKanbanColumnDto,
  ) {
    return this.kanbanColumnsService.create(projectId, body);
  }

  @Patch(':columnId')
  update(
    @Param('columnId') columnId: string,
    @Body() body: UpdateKanbanColumnDto,
  ) {
    return this.kanbanColumnsService.update(columnId, body);
  }

  @Delete(':columnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('columnId') columnId: string) {
    return this.kanbanColumnsService.remove(columnId);
  }

  @Put('reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Body() body: ReorderColumnsDto,
  ) {
    return this.kanbanColumnsService.reorder(projectId, body.columns);
  }
}
