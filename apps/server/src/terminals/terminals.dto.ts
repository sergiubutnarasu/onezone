import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterTerminalDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  hostname!: string;
}

export class AssignTaskDto {
  @IsUUID()
  taskId!: string;
}

export class RunProjectBuilderDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  repository?: string;

  @IsString()
  @MinLength(1)
  boardPrompt!: string;

  @IsUUID()
  agentId!: string;

  @IsString()
  @MinLength(1)
  model!: string;
}
