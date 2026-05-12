import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateMeetingDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
