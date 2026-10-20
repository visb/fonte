import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Story 216 — período de serviço antigo (já encerrado) registrado pela aba
 * Histórico. `endDate` é opcional no DTO só para o service devolver a mensagem
 * amigável ("informe o fim" / "já há um período em andamento"); as regras de
 * data e de sobreposição ficam no `StaffServicePeriodService`.
 */
export class CreateServicePeriodDto {
  @IsOptional()
  @IsUUID()
  houseId?: string | null;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
