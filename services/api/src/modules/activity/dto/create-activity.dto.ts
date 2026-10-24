import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ActivityStatus } from '@fonte/types';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  houseId?: string | null;

  /** Story 224: só DRAFT, REQUESTED ou TODO na criação (quem pode: ver service). */
  @IsOptional()
  @IsIn([ActivityStatus.DRAFT, ActivityStatus.REQUESTED, ActivityStatus.TODO])
  status?: ActivityStatus;

  @IsOptional()
  @IsUUID()
  responsibleStaffId?: string | null;
}
