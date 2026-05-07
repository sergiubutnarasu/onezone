import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class InstallSkillDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  skillName!: string;
}

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  repository?: string;

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
  @IsString()
  repository?: string;

  @IsOptional()
  @IsUUID()
  defaultAgentId?: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;
}
