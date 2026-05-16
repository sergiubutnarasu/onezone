import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateKanbanColumnDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
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

export class UpdateKanbanColumnDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
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
