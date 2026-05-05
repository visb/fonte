import { IsOptional, IsUUID } from 'class-validator';

export class CreateHouseMinistryDto {
  @IsUUID()
  ministryId: string;

  @IsUUID()
  @IsOptional()
  leaderId?: string;
}
