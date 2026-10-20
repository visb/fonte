import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Story 217 — reintegração do servo desligado: abre um período novo com início
 * em `date` (não futura, ≥ fim do último período) na casa `houseId` (ausente =
 * mantém a última casa do cadastro; `null` = sem casa).
 */
export class ReinstateStaffDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  houseId?: string | null;
}
