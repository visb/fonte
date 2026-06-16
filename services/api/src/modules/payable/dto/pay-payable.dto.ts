import { IsDateString, IsOptional } from 'class-validator';

export class PayPayableDto {
  /** Data de pagamento (default: hoje). */
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
