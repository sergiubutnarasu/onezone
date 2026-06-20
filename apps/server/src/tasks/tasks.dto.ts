import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  terminalId!: string;

  @IsUUID()
  agentId!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsBoolean()
  useTaskAgentAndModel?: boolean;
}

export class TaskOrderItemDto {
  @IsUUID()
  id!: string;

  /** null means the task is moved to the virtual Backlog column */
  @IsOptional()
  @ValidateIf((o) => o.columnId != null)
  @IsUUID()
  columnId!: string | null;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderTasksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskOrderItemDto)
  tasks!: TaskOrderItemDto[];
}

export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  orderBy?: string;

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}

export class UpdateTaskColumnDto {
  /** null means move the task to the virtual Backlog */
  @IsOptional()
  @ValidateIf((o) => o.columnId != null)
  @IsUUID()
  columnId?: string | null;
}

export class ToggleCompletedDto {
  @IsBoolean()
  completed!: boolean;
}

export class AssignTerminalDto {
  @IsUUID()
  terminalId!: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.columnId != null)
  @IsUUID()
  columnId?: string | null;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  useTaskAgentAndModel?: boolean;
}

