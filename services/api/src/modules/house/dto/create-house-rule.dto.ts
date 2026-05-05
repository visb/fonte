import { IsString, MinLength } from 'class-validator';

export class CreateHouseRuleDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;
}
