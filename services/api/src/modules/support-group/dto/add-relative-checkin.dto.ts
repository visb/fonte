import { IsString, IsNotEmpty } from 'class-validator';

export class AddRelativeCheckinDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
