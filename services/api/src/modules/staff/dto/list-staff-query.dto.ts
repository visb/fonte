import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { StaffListStatus } from '@fonte/types';

export const STAFF_LIST_STATUSES: readonly StaffListStatus[] = ['active', 'dismissed'];

/**
 * Story 217 — `GET /staff?status=active|dismissed` (default `active`).
 * Story 223 — `search` (nome sem acento/caixa ou dígitos do CPF) e `houseId`
 * (só ADMIN; ignorado para os demais — o escopo vem do staff autenticado).
 */
export class ListStaffQueryDto {
  @IsOptional()
  @IsIn([...STAFF_LIST_STATUSES])
  status?: StaffListStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  houseId?: string;
}
