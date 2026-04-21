import { IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterAgentDto {
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
