import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  defaultAgentId!: string;

  @IsString()
  defaultModel!: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  defaultAgentId?: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;
}
