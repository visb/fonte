import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateAssociateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Telefone no formato E.164 (ex.: +5562999998888). */
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'whatsapp must be a valid E.164 phone number (e.g. +5562999998888)',
  })
  whatsapp: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsPositive()
  contributionAmount: number;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay: number;
}
