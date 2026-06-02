import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BibleCourseEnrollmentStatus } from '@fonte/types';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsEnum(BibleCourseEnrollmentStatus)
  status?: BibleCourseEnrollmentStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
