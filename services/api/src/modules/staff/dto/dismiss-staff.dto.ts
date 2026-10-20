import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { StaffDismissalReason } from '@fonte/types';

/**
 * Story 217 — desligamento do servo. A regra "observação obrigatória quando
 * OTHER" e as regras de data (não futura, ≥ início do período aberto) ficam no
 * `StaffService.dismiss`, com as mensagens de `STAFF_DISMISSAL_MESSAGES`.
 */
export class DismissStaffDto {
  @IsDateString()
  date: string;

  @IsEnum(StaffDismissalReason)
  reason: StaffDismissalReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
