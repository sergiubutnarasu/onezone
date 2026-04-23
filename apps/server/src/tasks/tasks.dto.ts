import { IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

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
