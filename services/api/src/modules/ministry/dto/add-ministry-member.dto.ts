import { IsUUID } from 'class-validator';

// Story 205: filho volta a ser membro do ministério (contrato pré-197).
export class AddMinistryResidentDto {
  @IsUUID()
  residentId: string;
}

export class AddMinistryStaffDto {
  @IsUUID()
  staffId: string;
}
