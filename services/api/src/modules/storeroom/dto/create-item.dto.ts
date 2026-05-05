import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsUUID()
  houseId: string;
}
