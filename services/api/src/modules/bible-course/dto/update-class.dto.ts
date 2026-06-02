import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { BibleCourseClassStatus } from '@fonte/types';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID()
  houseId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(BibleCourseClassStatus)
  status?: BibleCourseClassStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
