import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const PROJECT_STATUSES = ['pending', 'ready', 'failed'] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

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

export class UpdateProjectStatusDto {
  @IsIn(PROJECT_STATUSES)
  status!: ProjectStatusValue;
}

export class ImportColumnDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  agent?: string | null;

  @IsOptional()
  @IsString()
  model?: string | null;
}

export class ImportSkillDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  skillName!: string;
}

export class ImportProjectDto {
  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  repository?: string | null;

  @IsString()
  @IsNotEmpty()
  defaultAgent!: string;

  @IsString()
  @IsNotEmpty()
  defaultModel!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportColumnDto)
  columns!: ImportColumnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSkillDto)
  skills?: ImportSkillDto[];
}
