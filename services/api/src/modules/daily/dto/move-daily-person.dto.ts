import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { DailyPersonType } from '@fonte/types';

/** Story 225 — movimento de uma pessoa no board (rascunho). */
export class MoveDailyPersonDto {
  @IsEnum(DailyPersonType)
  personType: DailyPersonType;

  @IsUUID()
  personId: string;

  /** `null` = "Sem ministério". Ausente → 400 (o destino é sempre explícito). */
  @ValidateIf((o: MoveDailyPersonDto) => o.toMinistryId !== null)
  @IsUUID()
  toMinistryId: string | null;
}
