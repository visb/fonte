import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { SupplyRoomCategory } from '@fonte/types';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsEnum(SupplyRoomCategory)
  category: SupplyRoomCategory;

  @IsUUID()
  houseId: string;
}
