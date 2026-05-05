import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateHouseMinistryDto {
  @ValidateIf((o: UpdateHouseMinistryDto) => o.leaderId !== null)
  @IsUUID()
  leaderId: string | null;
}
