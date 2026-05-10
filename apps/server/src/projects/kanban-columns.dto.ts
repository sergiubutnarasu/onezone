import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateKanbanColumnDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class UpdateKanbanColumnDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
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
