import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuditOutcome } from '@fonte/types';

/**
 * Filtros de `GET /audit` (story 199). Filtro desconhecido é recusado pelo
 * `ValidationPipe` global (`forbidNonWhitelisted`).
 */
export class ListAuditEventsDto {
  /** Início do período (ISO 8601). Default: 30 dias atrás. */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Fim do período (ISO 8601, exclusivo). Default: agora. */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Casa — casa também o lado anterior de transferências. */
  @IsOptional()
  @IsUUID()
  houseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9_.-]+$/)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9_-]+$/)
  targetType?: string;

  /** Id do recurso — casa também como recurso principal (ex.: filho da parcela). */
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @IsEnum(AuditOutcome)
  outcome?: AuditOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
