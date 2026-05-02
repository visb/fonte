import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateHouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;
}
