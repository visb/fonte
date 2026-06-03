import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@fonte/types';

export class RegisterPaymentDto {
  @IsDateString()
  paidAt: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
