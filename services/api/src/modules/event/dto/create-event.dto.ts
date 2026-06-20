import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RegistrationFieldDto } from './registration-field.dto';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  /** Inscrição habilitada (story 67). Default false: evento só-divulgação. */
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  /** Cobrança da inscrição (story 69). Default false: inscrição grátis. */
  @IsOptional()
  @IsBoolean()
  paymentEnabled?: boolean;

  /** Preço líquido em centavos (story 69). Obrigatório quando paymentEnabled. */
  @IsOptional()
  @IsInt()
  @Min(1)
  priceCents?: number | null;

  /** Campos custom do formulário de inscrição (story 68). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistrationFieldDto)
  registrationFields?: RegistrationFieldDto[];

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string | null;

  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string | null;
}
