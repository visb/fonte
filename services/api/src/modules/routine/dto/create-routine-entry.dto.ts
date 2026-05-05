import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoutineEntryDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  houseId: string;

  @IsUUID()
  responsibleId: string;

  @IsOptional()
  @IsUUID()
  residentId?: string | null;
}
