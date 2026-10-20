import { IsDateString, IsOptional, IsUUID, ValidateIf } from 'class-validator';

/**
 * Story 216 — correção de período de serviço. Tudo opcional, sem `null` nas
 * datas (não se reabre período por aqui). No período aberto só `startDate` é
 * aceito — checado no `StaffServicePeriodService`.
 */
export class UpdateServicePeriodDto {
  @IsOptional()
  @IsUUID()
  houseId?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  startDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  endDate?: string;
}
