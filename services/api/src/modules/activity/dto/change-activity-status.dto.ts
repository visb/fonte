import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ActivityStatus } from '@fonte/types';

export class ChangeActivityStatusDto {
  @IsEnum(ActivityStatus)
  status: ActivityStatus;

  @IsOptional()
  @IsUUID()
  responsibleStaffId?: string | null;
}
