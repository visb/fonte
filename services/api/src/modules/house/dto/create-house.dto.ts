import { IsNotEmpty, IsString } from 'class-validator';

export class CreateHouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
