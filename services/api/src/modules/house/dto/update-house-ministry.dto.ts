import { IsIn, IsUUID, ValidateIf } from 'class-validator';

export class UpdateHouseMinistryDto {
  @ValidateIf((o: UpdateHouseMinistryDto) => o.leaderId !== null)
  @IsUUID()
  leaderId: string | null;

  @ValidateIf((o: UpdateHouseMinistryDto) => o.leaderType !== null)
  @IsIn(['STAFF', 'RESIDENT'])
  leaderType: 'STAFF' | 'RESIDENT' | null;
}
