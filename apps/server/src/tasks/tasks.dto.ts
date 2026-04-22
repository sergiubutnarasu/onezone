import { IsArray, IsEnum, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';

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

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}

export class AssignAgentDto {
  @IsUUID()
  agentId!: string;
}
