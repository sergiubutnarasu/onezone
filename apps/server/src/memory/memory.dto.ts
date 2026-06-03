import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class WriteMemoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5_000_000) // ~5 MB
  content!: string;
}
