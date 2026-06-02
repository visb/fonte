import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  houseId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
