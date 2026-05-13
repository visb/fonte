import { IsEmail, IsString, MinLength } from 'class-validator';

export class GenerateRelativeAccessDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
