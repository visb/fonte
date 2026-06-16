import { IsDateString, IsOptional } from 'class-validator';

export class PayablesSummaryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
