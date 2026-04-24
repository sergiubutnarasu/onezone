import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

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
}

export class TaskOrderItemDto {
  @IsUUID()
  id!: string;

  @IsEnum(TaskStatus)
  status!: TaskStatus;

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
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  status?: TaskStatus[];
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
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
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
