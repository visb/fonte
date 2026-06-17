import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ActivityStatus } from '@fonte/types';

export class ListActivitiesQueryDto {
  @IsOptional()
  @IsUUID()
  houseId?: string;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @IsOptional()
  @IsUUID()
  responsibleStaffId?: string;
}
