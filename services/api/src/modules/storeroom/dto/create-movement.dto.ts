import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { MovementType } from '@fonte/types';

export class CreateMovementDto {
  @IsUUID()
  itemId: string;

  @IsEnum(MovementType)
  type: MovementType;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsUUID()
  responsibleId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string | null;
}
