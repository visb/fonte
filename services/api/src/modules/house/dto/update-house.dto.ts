import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateHouseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
