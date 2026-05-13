import { IsString, MinLength } from 'class-validator';

export class ResetResidentPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}
