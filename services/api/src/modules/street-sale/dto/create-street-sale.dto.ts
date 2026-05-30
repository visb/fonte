import { IsDateString, IsEnum, IsInt, IsUUID, Min } from 'class-validator';
import { StreetSaleType } from '@fonte/types';

export class CreateStreetSaleDto {
  @IsUUID()
  houseId: string;

  @IsDateString()
  date: string;

  @IsEnum(StreetSaleType)
  type: StreetSaleType;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsInt()
  @Min(0)
  amountPix: number;

  @IsInt()
  @Min(0)
  amountCash: number;

  @IsInt()
  @Min(0)
  amountCard: number;
}
