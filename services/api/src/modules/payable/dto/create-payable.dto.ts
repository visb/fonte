import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PayableCategory } from '@fonte/types';

export class CreatePayableDto {
  @IsString()
  @MaxLength(255)
  description: string;

  /** Valor em centavos. */
  @IsInt()
  @Min(0)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsEnum(PayableCategory)
  category: PayableCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
