import { IsIn, IsOptional } from 'class-validator';
import type { StaffListStatus } from '@fonte/types';

export const STAFF_LIST_STATUSES: readonly StaffListStatus[] = ['active', 'dismissed'];

/** Story 217 — `GET /staff?status=active|dismissed` (default `active`). */
export class ListStaffQueryDto {
  @IsOptional()
  @IsIn([...STAFF_LIST_STATUSES])
  status?: StaffListStatus;
}
