import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateRoutineEntryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
