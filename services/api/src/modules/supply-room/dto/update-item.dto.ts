import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SupplyRoomCategory } from '@fonte/types';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsEnum(SupplyRoomCategory)
  category?: SupplyRoomCategory;
}
