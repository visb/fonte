import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  residentId: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
