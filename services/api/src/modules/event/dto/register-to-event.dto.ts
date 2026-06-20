import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RegistrationAnswerValue } from '@fonte/types';

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

  /**
   * Respostas dos campos custom (story 68). Mapa fieldId → valor; a validação
   * por tipo é dinâmica (depende da definição do evento) e roda no service.
   */
  @IsOptional()
  @IsObject()
  answers?: Record<string, RegistrationAnswerValue>;
}
