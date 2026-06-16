import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PayableCategory, PayableStatus } from '@fonte/types';

export class ListPayablesDto {
  @IsOptional()
  @IsEnum(PayableStatus)
  status?: PayableStatus;

  @IsOptional()
  @IsEnum(PayableCategory)
  category?: PayableCategory;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
