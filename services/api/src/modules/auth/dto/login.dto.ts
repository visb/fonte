import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // E-mail ou telefone. Contém '@' → tratado como e-mail; senão → telefone (normalizado
  // para dígitos antes da consulta).
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
