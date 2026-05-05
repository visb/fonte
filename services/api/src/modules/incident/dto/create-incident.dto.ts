import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IncidentSeverity } from '@fonte/types';

export class CreateIncidentDto {
  @IsDateString()
  date: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

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
