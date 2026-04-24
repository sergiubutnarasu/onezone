import { IsString } from 'class-validator';

export class UpdateAgentDto {
  @IsString()
  model!: string;
}
