import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { RESIDENT_LOOKUP_MIN_LENGTH } from '@fonte/types';

/**
 * Story 218 — termo da busca de candidatos a reacolhimento: nome parcial (sem
 * acento/caixa) ou CPF (com ou sem máscara). Mínimo de 3 caracteres úteis.
 */
export class LookupResidentsQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o nome ou o CPF para buscar.' })
  @MinLength(RESIDENT_LOOKUP_MIN_LENGTH, {
    message: `Digite ao menos ${RESIDENT_LOOKUP_MIN_LENGTH} caracteres para buscar.`,
  })
  @MaxLength(100, { message: 'Termo de busca muito longo.' })
  q: string;
}
