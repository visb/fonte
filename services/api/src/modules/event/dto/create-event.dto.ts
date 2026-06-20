import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  /** Inscrição habilitada (story 67). Default false: evento só-divulgação. */
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

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
