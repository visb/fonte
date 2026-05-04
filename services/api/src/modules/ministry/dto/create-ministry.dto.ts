import { IsString, MinLength } from 'class-validator';

export class CreateMinistryDto {
  @IsString()
  @MinLength(1)
  name: string;
}
