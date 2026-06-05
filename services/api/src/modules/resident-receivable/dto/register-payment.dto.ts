import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FamilyInvestment, PaymentMethod } from '@fonte/types';

export class RegisterPaymentDto {
  @IsDateString()
  paidAt: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsEnum(FamilyInvestment)
  paidFamilyInvestment?: FamilyInvestment;

  @IsOptional()
  @IsString()
  notes?: string;
}
