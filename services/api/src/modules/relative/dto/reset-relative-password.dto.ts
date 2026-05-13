import { IsString, MinLength } from 'class-validator';

export class ResetRelativePasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}
