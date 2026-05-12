import { IsUUID } from 'class-validator';

export class AddMinistryResidentDto {
  @IsUUID()
  residentId: string;
}

export class AddMinistryStaffDto {
  @IsUUID()
  staffId: string;
}
