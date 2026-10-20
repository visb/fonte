import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ResidentStatus } from '@fonte/types';

/**
 * Story 215 — passagem antiga (já encerrada) registrada pela aba Histórico.
 * Entrada e saída obrigatórias; o status precisa ser de saída e a casa só pode
 * faltar em passagem `ARCHIVED` — regras checadas no `AdmissionService`.
 */
export class CreateAdmissionDto {
  @IsOptional()
  @IsUUID()
  houseId?: string | null;

  @IsDateString()
  entryDate: string;

  @IsDateString()
  exitDate: string;

  @IsEnum(ResidentStatus)
  status: ResidentStatus;
}
