import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Gender } from '@fonte/types';

/**
 * DTO dedicado à correção dos "dados de identidade" na reintrodução (story 147).
 * Só os 5 campos não-editáveis do banner: nome, CPF, RG, nascimento e gênero.
 * Validações espelham as de `UpdateResidentDto`; CPF/RG opcionais e anuláveis.
 * A rota é ADMIN-only (dado sensível) — o enforcement fica no controller.
 */
export class UpdateResidentIdentityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  cpf?: string | null;

  @IsOptional()
  @IsString()
  rg?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;
}
