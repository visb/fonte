import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterToEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** Telefone/WhatsApp ou e-mail. Validação básica de comprimento mínimo. */
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  contact: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;
}
