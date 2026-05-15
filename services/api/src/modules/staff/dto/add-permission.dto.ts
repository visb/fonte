import { IsEnum } from 'class-validator';
import { StaffPermissionType } from '@fonte/types';

export class AddPermissionDto {
  @IsEnum(StaffPermissionType)
  type: StaffPermissionType;
}
