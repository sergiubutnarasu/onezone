import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  cronExpression!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsUUID()
  startColumnId!: string;

  @IsUUID()
  terminalId!: string;

  @IsUUID()
  agentId!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsBoolean()
  useScheduleAgentAndModel?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  runOnce?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUUID()
  startColumnId?: string;

  @IsOptional()
  @IsUUID()
  terminalId?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  useScheduleAgentAndModel?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  runOnce?: boolean;
}
