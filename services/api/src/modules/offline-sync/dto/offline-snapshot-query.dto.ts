import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query do `GET /houses/:houseId/offline-snapshot` (story 177).
 *
 * `since` é o `syncedAt` devolvido na sincronização anterior — sempre o relógio
 * do **servidor**, nunca o do aparelho. Ausente (ou velho demais, o que o
 * service decide) → sincronização completa.
 *
 * `IsISO8601` com `strict` recusa data impossível ("2026-02-31") em vez de deixar
 * o `Date` normalizar em silêncio para o mês seguinte e devolver um delta com
 * janela errada.
 */
export class OfflineSnapshotQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'since deve ser uma data ISO 8601' })
  since?: string;
}
