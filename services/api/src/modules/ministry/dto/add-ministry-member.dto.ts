import { IsUUID } from 'class-validator';

export class AddMinistryStaffDto {
  @IsUUID()
  staffId: string;
}
