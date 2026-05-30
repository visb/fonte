import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { StreetSaleType } from '@fonte/types';

export class GetStreetSalesReportDto {
  @IsEnum(StreetSaleType)
  type: StreetSaleType;

  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
  month: string;

  @IsOptional()
  @IsUUID()
  houseId?: string;
}
