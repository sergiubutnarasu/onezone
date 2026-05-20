import { IsString, Matches } from 'class-validator';

export class ActivateDto {
  @IsString()
  @Matches(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, {
    message: 'user_code must be in format XXXX-XXXX',
  })
  user_code!: string;
}
