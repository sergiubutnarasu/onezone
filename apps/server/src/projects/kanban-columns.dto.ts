import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateKanbanColumnDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  instructions!: string;

  @IsOptional()
  @ValidateIf((o) => o.agentId !== null)
  @IsUUID()
  agentId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.model !== null)
  @IsString()
  model?: string | null;
}

export class UpdateKanbanColumnDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  instructions?: string;

  @IsOptional()
  @ValidateIf((o) => o.agentId !== null)
  @IsUUID()
  agentId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.model !== null)
  @IsString()
  model?: string | null;
}

export class ColumnOrderItemDto {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(0)
  index!: number;
}

export class ReorderColumnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnOrderItemDto)
  columns!: ColumnOrderItemDto[];
}
