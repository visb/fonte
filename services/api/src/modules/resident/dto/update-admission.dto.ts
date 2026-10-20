import { IsDateString, IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ResidentStatus } from '@fonte/types';

/**
 * Story 215 — correção de passagem pela aba Histórico. Tudo opcional, mas sem
 * `null` nas datas e no status (não se reabre passagem por aqui). No
 * acolhimento atual só `entryDate` é aceito — checado no `AdmissionService`.
 */
export class UpdateAdmissionDto {
  @IsOptional()
  @IsUUID()
  houseId?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  entryDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  exitDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ResidentStatus)
  status?: ResidentStatus;
}
