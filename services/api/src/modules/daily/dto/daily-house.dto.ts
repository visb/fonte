import { IsOptional, IsUUID } from 'class-validator';

/**
 * Story 225 — casa da daily. ADMIN informa `houseId` (sem ele, vale a própria
 * lotação); COORDINATOR fica na própria casa (outra casa → 403).
 */
export class DailyHouseDto {
  @IsOptional()
  @IsUUID()
  houseId?: string;
}
